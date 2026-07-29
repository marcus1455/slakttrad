import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * send-invite-email – Supabase Edge Function
 *
 * Called directly from the client after inviteTreeCollaborator() succeeds.
 * Payload: { email, meta: { inviteeName, inviterName, treeName, personName, personPhotoUrl } }
 *
 * Flow:
 *   1. Uses Supabase Admin API to invite the user (creates account + generates accept token)
 *   2. Sends a branded HTML email via Resend with the accept link + optional person photo
 *
 * Required secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets):
 *   SUPABASE_URL          – your project URL (auto-available in Edge Functions)
 *   SUPABASE_SERVICE_ROLE_KEY – service role key (auto-available in Edge Functions)
 *   RESEND_API_KEY        – your Resend API key (resend.com)
 *   FROM_EMAIL            – e.g. "Släktträd <no-reply@yourdomain.com>"
 *   SITE_URL              – e.g. "https://slakttrad-two.vercel.app"
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Släktträd <onboarding@resend.dev>'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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

  // ── Step 1: Invite user via Supabase Admin API ────────────────────────────
  // This creates the account (if it doesn't exist) and generates a secure accept link.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    toEmail,
    {
      redirectTo: `${SITE_URL}/`,
      data: {
        invited_by: inviterName,
        tree_name: treeName,
      },
    },
  )

  if (inviteError) {
    // User may already exist — still send a notification email with login link
    console.warn('Admin invite error (user may exist):', inviteError.message)
  }

  // Build the accept URL from the invite token if available
  let acceptUrl = `${SITE_URL}/logga-in`
  if (inviteData?.user) {
    // The confirmation link is available via the Supabase admin generateLink API
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: toEmail,
      options: { redirectTo: `${SITE_URL}/` },
    })
    if (linkData?.properties?.action_link) {
      acceptUrl = linkData.properties.action_link
    }
  }

  // ── Step 2: Send branded email via Resend ─────────────────────────────────
  const isExistingUser = !!inviteError
  const html = buildInviteHtml({
    inviteeName,
    inviterName,
    treeName,
    personName,
    personPhotoUrl,
    acceptUrl,
    existingUser: isExistingUser,
  })

  const subject = `${inviterName} bjuder in dig till "${treeName}"`

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
    body: JSON.stringify({ from: FROM_EMAIL, to: [toEmail], subject, html }),
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
})

function buildInviteHtml(opts: {
  inviteeName: string
  inviterName: string
  treeName: string
  personName?: string
  personPhotoUrl?: string
  acceptUrl: string
  existingUser?: boolean
}): string {
  const { inviteeName, inviterName, treeName, personName, personPhotoUrl, acceptUrl, existingUser } = opts

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

  const ctaLabel = existingUser ? 'Logga in och se trädet' : 'Acceptera inbjudan'
  const footerNote = existingUser
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
