import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

/**
 * send-invite-email – Supabase Edge Function
 *
 * Can be called in two ways:
 *
 * 1. As a Supabase Auth Hook (Send Email hook) – Supabase calls this automatically
 *    when auth.admin.inviteUserByEmail() is triggered.
 *    Payload: { user: { email, user_metadata }, email_data: { token_hash, email_action_type, site_url } }
 *
 * 2. Directly from the client after inviteTreeCollaborator() succeeds.
 *    Payload: { email: string, meta: InviteMeta }
 *    In this mode we send a "you've been added" notification email (no token needed).
 *
 * Required secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets):
 *   RESEND_API_KEY   – your Resend API key (resend.com)
 *   FROM_EMAIL       – e.g. "Släktträd <no-reply@yourdomain.com>"
 *   SITE_URL         – e.g. "https://slakttrad.se"
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Släktträd <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  // ── Mode 1: Auth Hook payload ─────────────────────────────────────────────
  if ('email_data' in body) {
    const emailData = body.email_data as Record<string, string> | undefined
    const emailActionType = emailData?.email_action_type

    // Only handle "invite" — let Supabase handle other auth emails natively
    if (emailActionType !== 'invite') {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const user = body.user as {
      email?: string
      user_metadata?: Record<string, string>
    }

    const toEmail = user.email ?? ''
    const userMeta = user.user_metadata ?? {}
    const inviteeName = (userMeta.invitee_name as string | undefined) ?? toEmail
    const treeName = (userMeta.tree_name as string | undefined) ?? 'ett familjeträd'
    const inviterName = (userMeta.inviter_name as string | undefined) ?? 'Någon'
    const personPhotoUrl = userMeta.person_photo_url as string | undefined
    const personName = userMeta.person_name as string | undefined

    const siteUrl = emailData?.site_url ?? SITE_URL
    const tokenHash = emailData?.token_hash ?? ''
    const acceptUrl = `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=invite&next=/`

    return sendEmail(toEmail, `${inviterName} bjuder in dig till "${treeName}"`,
      buildInviteHtml({ inviteeName, inviterName, treeName, personName, personPhotoUrl, acceptUrl }))
  }

  // ── Mode 2: Direct client call ────────────────────────────────────────────
  const toEmail = body.email as string | undefined
  if (!toEmail) {
    return new Response('Missing email', { status: 400 })
  }

  const meta = (body.meta ?? {}) as {
    inviteeName?: string
    inviterName?: string
    treeName?: string
    personName?: string
    personPhotoUrl?: string
  }

  const inviteeName = meta.inviteeName ?? toEmail.split('@')[0]
  const inviterName = meta.inviterName ?? 'Någon'
  const treeName = meta.treeName ?? 'ett familjeträd'
  const personName = meta.personName
  const personPhotoUrl = meta.personPhotoUrl

  // Direct invites don't have a token — link goes to login page
  const loginUrl = `${SITE_URL}/logga-in`

  return sendEmail(
    toEmail,
    `${inviterName} bjuder in dig till "${treeName}"`,
    buildInviteHtml({
      inviteeName,
      inviterName,
      treeName,
      personName,
      personPhotoUrl,
      acceptUrl: loginUrl,
      directInvite: true,
    }),
  )
})

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email')
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return new Response(JSON.stringify({ error: err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function buildInviteHtml(opts: {
  inviteeName: string
  inviterName: string
  treeName: string
  personName?: string
  personPhotoUrl?: string
  acceptUrl: string
  directInvite?: boolean
}): string {
  const { inviteeName, inviterName, treeName, personName, personPhotoUrl, acceptUrl, directInvite } = opts

  const photoSection = personPhotoUrl
    ? `
      <div style="text-align:center;margin:24px 0 8px;">
        <img
          src="${escHtml(personPhotoUrl)}"
          alt="${escHtml(personName ?? '')}"
          width="96" height="96"
          style="border-radius:50%;object-fit:cover;border:3px solid #e6f0ec;"
        />
        ${personName ? `<p style="margin:8px 0 0;font-size:15px;color:#4a5a4c;font-weight:600;">${escHtml(personName)}</p>` : ''}
      </div>`
    : ''

  const ctaLabel = directInvite ? 'Logga in och se trädet' : 'Acceptera inbjudan'
  const footerNote = directInvite
    ? 'Logga in med den e-postadress som detta mejl skickades till.'
    : 'Länken är giltig i 24 timmar. Om du inte förväntar dig detta mejl kan du ignorera det.'

  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:100%;">

        <tr>
          <td style="background:linear-gradient(135deg,#2f5d50 0%,#3d7a68 100%);padding:32px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7);">Inbjudan</p>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">🌳 Släktträd</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1c241c;line-height:1.5;">Hej ${escHtml(inviteeName)},</p>
            <p style="margin:0 0 24px;font-size:16px;color:#1c241c;line-height:1.6;">
              <strong>${escHtml(inviterName)}</strong> bjuder in dig att se och redigera
              familjeträdet <strong>&ldquo;${escHtml(treeName)}&rdquo;</strong>.
            </p>

            ${photoSection}

            <div style="text-align:center;margin:32px 0;">
              <a
                href="${escHtml(acceptUrl)}"
                style="display:inline-block;background:#2f5d50;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:.02em;"
              >
                ${ctaLabel}
              </a>
            </div>

            <p style="margin:0;font-size:13px;color:#8a9a8c;line-height:1.5;">${footerNote}</p>
          </td>
        </tr>

        <tr>
          <td style="background:#f0f4f1;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#8a9a8c;">
              Skickat via Släktträd &mdash; ett verktyg för att bygga och dela familjehistoria.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
