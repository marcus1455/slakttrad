import type { Node } from 'relatives-tree/lib/types'
import { createBlankFamily } from '../data/blank'
import { SEED_FAMILY } from '../data/seed'
import type {
  FamilyStore,
  Gender,
  LoadedTree,
  PersonProfile,
  TreeCheckpoint,
  TreeMeta,
} from '../types'
import { normalizeProfileNicknames } from './personName'
import { DEFAULT_TREE_SLUG, supabase } from './supabase'
import { avatarUrlFromUser, displayNameFromUser } from './userDisplay'

type FamilyTreeRow = {
  id: string
  slug: string
  name: string
  root_id: string
  profiles: Record<string, PersonProfile>
  nodes: Node[]
  share_token: string | null
  owner_id?: string | null
  checkpoints?: TreeCheckpoint[] | null
}

export type TreeAccessRole = 'owner' | 'editor' | 'viewer'

export type CollaboratorRole = 'editor' | 'viewer'

export type TreeSummary = {
  id: string
  slug: string
  name: string
  role: TreeAccessRole
  updatedAt?: string
  personCount: number
  /** Optional cover image for dashboard tiles. */
  coverUrl?: string | null
  /** Lightweight gender markers for dashboard previews. */
  previewGenders: Array<'male' | 'female'>
}

function newSlug() {
  return `trad-${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`
}

function normalizeCheckpoints(
  value: TreeCheckpoint[] | null | undefined,
): TreeCheckpoint[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  return value
}

function rowToLoaded(row: FamilyTreeRow): LoadedTree {
  if (!row.share_token) {
    throw new Error('Trädet saknar delningstoken')
  }
  return {
    store: {
      rootId: row.root_id,
      profiles: normalizeProfileNicknames(row.profiles ?? {}),
      nodes: row.nodes,
      checkpoints: normalizeCheckpoints(row.checkpoints),
    },
    meta: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shareToken: row.share_token,
      ownerId: row.owner_id ?? null,
    },
  }
}

async function ensureShareToken(row: FamilyTreeRow): Promise<FamilyTreeRow> {
  const token = crypto.randomUUID().replaceAll('-', '')
  const { data, error } = await supabase
    .from('family_trees')
    .update({ share_token: token })
    .eq('id', row.id)
    .select('id, slug, name, root_id, profiles, nodes, share_token, owner_id, checkpoints')
    .single()
  if (error) throw error
  return data as FamilyTreeRow
}

export async function loadFamilyBySlug(slug: string): Promise<LoadedTree> {
  const { data, error } = await supabase
    .from('family_trees')
    .select('id, slug, name, root_id, profiles, nodes, share_token, owner_id, checkpoints')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    if (slug === DEFAULT_TREE_SLUG) {
      return seedFamily(slug)
    }
    throw new Error('Trädet finns inte')
  }

  if (!data.nodes?.length || !data.profiles || !data.root_id) {
    if (slug === DEFAULT_TREE_SLUG) {
      return seedFamily(slug)
    }
    throw new Error('Trädet är tomt eller skadat')
  }

  let row = data as FamilyTreeRow
  if (!row.share_token) {
    row = await ensureShareToken(row)
  }

  return rowToLoaded(row)
}

/** Create a fresh one-person board owned by the signed-in user. */
export async function createNewFamily(
  treeName = 'Mitt släktträd',
): Promise<LoadedTree> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Du måste vara inloggad för att skapa ett nytt träd')
  }

  const starterName = displayNameFromUser(user)
  const starterPhoto = avatarUrlFromUser(user)
  const meta = user.user_metadata ?? {}
  const starterGender: Gender =
    meta.starter_gender === 'male' || meta.starter_gender === 'female'
      ? meta.starter_gender
      : 'female'
  const store = createBlankFamily(starterName, {
    birthYear:
      typeof meta.starter_birth_year === 'string' ? meta.starter_birth_year.trim() : '',
    email: user.email ?? '',
    nickname:
      typeof meta.starter_nickname === 'string' ? meta.starter_nickname.trim() : '',
    photoUrl: starterPhoto ?? undefined,
    phone: typeof meta.starter_phone === 'string' ? meta.starter_phone.trim() : '',
    gender: starterGender,
  })
  return createFamilyFromStore(store, treeName)
}

/** Persist an existing in-memory store as a new owned cloud tree. */
export async function createFamilyFromStore(
  store: FamilyStore,
  treeName = 'Mitt släktträd',
): Promise<LoadedTree> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Du måste vara inloggad för att skapa ett nytt träd')
  }

  const slug = newSlug()
  const token = crypto.randomUUID().replaceAll('-', '')

  const { data, error } = await supabase
    .from('family_trees')
    .insert({
      slug,
      name: treeName.trim() || 'Mitt släktträd',
      root_id: store.rootId,
      profiles: store.profiles,
      nodes: store.nodes,
      checkpoints: store.checkpoints ?? [],
      share_token: token,
      owner_id: user.id,
    })
    .select('id, slug, name, root_id, profiles, nodes, share_token, owner_id, checkpoints')
    .single()

  if (error) throw error
  return rowToLoaded(data as FamilyTreeRow)
}

function summarizeNodes(nodes: unknown): {
  personCount: number
  previewGenders: Array<'male' | 'female'>
} {
  if (!Array.isArray(nodes)) return { personCount: 0, previewGenders: [] }
  const previewGenders: Array<'male' | 'female'> = []
  for (const raw of nodes) {
    const gender =
      raw && typeof raw === 'object' && 'gender' in raw
        ? (raw as { gender?: string }).gender
        : undefined
    if (gender === 'male' || gender === 'female') {
      previewGenders.push(gender)
    }
  }
  return {
    personCount: nodes.length,
    previewGenders: previewGenders.slice(0, 48),
  }
}

export async function listMyTrees(): Promise<TreeSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const email = (user.email ?? '').toLowerCase()

  const [{ data: owned, error: ownedError }, { data: collab, error: collabError }] =
    await Promise.all([
      supabase
        .from('family_trees')
        .select('id, slug, name, updated_at, nodes, cover_url')
        .eq('owner_id', user.id),
      supabase
        .from('tree_collaborators')
        .select(
          'tree_id, role, family_trees ( id, slug, name, updated_at, nodes, cover_url )',
        )
        .or(
          email
            ? `user_id.eq.${user.id},email.eq.${JSON.stringify(email)}`
            : `user_id.eq.${user.id}`,
        ),
    ])

  if (ownedError) throw ownedError
  if (collabError) throw collabError

  const byId = new Map<string, TreeSummary & { updated_at?: string }>()
  for (const row of owned ?? []) {
    const stats = summarizeNodes(row.nodes)
    byId.set(row.id, {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      role: 'owner',
      updated_at: row.updated_at as string | undefined,
      updatedAt: row.updated_at as string | undefined,
      personCount: stats.personCount,
      coverUrl: (row.cover_url as string | null | undefined) ?? null,
      previewGenders: stats.previewGenders,
    })
  }
  for (const row of collab ?? []) {
    const nested = row.family_trees as unknown
    const t = (Array.isArray(nested) ? nested[0] : nested) as
      | {
          id: string
          slug: string
          name: string
          updated_at?: string
          nodes?: unknown
          cover_url?: string | null
        }
      | null
      | undefined
    const accessRole: TreeAccessRole =
      row.role === 'viewer' ? 'viewer' : 'editor'
    if (t?.id && !byId.has(t.id)) {
      const stats = summarizeNodes(t.nodes)
      byId.set(t.id, {
        id: t.id,
        slug: t.slug,
        name: t.name,
        role: accessRole,
        updated_at: t.updated_at,
        updatedAt: t.updated_at,
        personCount: stats.personCount,
        coverUrl: t.cover_url ?? null,
        previewGenders: stats.previewGenders,
      })
    }
  }

  return [...byId.values()]
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .map(
      ({
        id,
        slug,
        name,
        role,
        updatedAt,
        personCount,
        coverUrl,
        previewGenders,
      }) => ({
        id,
        slug,
        name,
        role,
        updatedAt,
        personCount,
        coverUrl,
        previewGenders,
      }),
    )
}

/** Permanently delete a tree. Only the owner can delete (enforced by RLS). */
export async function deleteFamilyTree(treeId: string): Promise<void> {
  const { error } = await supabase.from('family_trees').delete().eq('id', treeId)
  if (error) throw error
}

/** Set or clear the dashboard cover image for a tree. */
export async function setTreeCoverUrl(
  treeId: string,
  coverUrl: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('family_trees')
    .update({ cover_url: coverUrl })
    .eq('id', treeId)
  if (error) throw error
}

export type TreeCollaborator = {
  id: string
  email: string
  userId: string | null
  role: CollaboratorRole
  createdAt: string
}

function mapCollaboratorRow(row: {
  id: string
  email: string
  user_id: string | null
  role?: string | null
  created_at: string
}): TreeCollaborator {
  return {
    id: row.id,
    email: row.email,
    userId: row.user_id,
    role: row.role === 'viewer' ? 'viewer' : 'editor',
    createdAt: row.created_at,
  }
}

export async function listTreeCollaborators(treeId: string): Promise<TreeCollaborator[]> {
  const { data, error } = await supabase
    .from('tree_collaborators')
    .select('id, email, user_id, role, created_at')
    .eq('tree_id', treeId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) =>
    mapCollaboratorRow(row as {
      id: string
      email: string
      user_id: string | null
      role?: string | null
      created_at: string
    }),
  )
}

export type InviteMeta = {
  /** Display name of the person being invited (shown in email) */
  inviteeName?: string
  /** Display name of the person sending the invite */
  inviterName?: string
  /** Name of the tree */
  treeName?: string
  /** Name of the person node this invite is linked to */
  personName?: string
  /** Public photo URL of the person node */
  personPhotoUrl?: string
}

export async function inviteTreeCollaborator(
  treeId: string,
  email: string,
  role: CollaboratorRole = 'editor',
  meta: InviteMeta = {},
): Promise<TreeCollaborator> {
  const { data, error } = await supabase.rpc('invite_tree_collaborator', {
    p_tree_id: treeId,
    p_email: email.trim(),
    p_role: role,
  })
  if (error) throw error
  const collaborator = mapCollaboratorRow(
    data as {
      id: string
      email: string
      user_id: string | null
      role?: string | null
      created_at: string
    },
  )

  // Fire-and-forget: trigger the invite email via Edge Function.
  // We don't await or throw on failure — the invite is already saved in DB.
  void supabase.functions
      .invoke('smart-handler', {
        body: {
          email: email.trim(),
          meta,
        },
      })
      .catch(() => {
        // Non-critical — email sending failure doesn't block the invite
      })

  return collaborator
}

export async function setTreeCollaboratorRole(
  collaboratorId: string,
  role: CollaboratorRole,
): Promise<TreeCollaborator> {
  const { data, error } = await supabase.rpc('set_tree_collaborator_role', {
    p_collaborator_id: collaboratorId,
    p_role: role,
  })
  if (error) throw error
  return mapCollaboratorRow(
    data as {
      id: string
      email: string
      user_id: string | null
      role?: string | null
      created_at: string
    },
  )
}

export async function removeTreeCollaborator(collaboratorId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_tree_collaborator', {
    p_collaborator_id: collaboratorId,
  })
  if (error) throw error
}

export async function loadFamilyByShareToken(token: string): Promise<LoadedTree> {
  const { data, error } = await supabase.rpc('get_tree_by_share_token', {
    p_token: token,
  })

  if (error) throw error

  const row = (Array.isArray(data) ? data[0] : data) as FamilyTreeRow | undefined
  if (!row?.nodes?.length || !row.profiles || !row.root_id || !row.share_token) {
    throw new Error('Delningslänken är ogiltig eller har gått ut')
  }

  return rowToLoaded(row)
}

export async function saveFamily(
  slug: string,
  store: FamilyStore,
  name?: string,
): Promise<void> {
  const { error } = await supabase
    .from('family_trees')
    .update({
      name: name ?? 'Släktträd',
      root_id: store.rootId,
      profiles: store.profiles,
      nodes: store.nodes,
      checkpoints: store.checkpoints ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug)

  if (error) throw error
}

export async function seedFamily(slug: string): Promise<LoadedTree> {
  const seed = structuredClone(SEED_FAMILY)
  const token = crypto.randomUUID().replaceAll('-', '')
  const { data, error } = await supabase
    .from('family_trees')
    .upsert(
      {
        slug,
        name: 'Davidsson',
        root_id: seed.rootId,
        profiles: seed.profiles,
        nodes: seed.nodes,
        checkpoints: [],
        share_token: token,
        owner_id: null,
      },
      { onConflict: 'slug' },
    )
    .select('id, slug, name, root_id, profiles, nodes, share_token, owner_id, checkpoints')
    .single()

  if (error) throw error
  return rowToLoaded(data as FamilyTreeRow)
}

export async function rotateShareToken(slug: string): Promise<TreeMeta> {
  const token = crypto.randomUUID().replaceAll('-', '')
  const { data, error } = await supabase
    .from('family_trees')
    .update({ share_token: token })
    .eq('slug', slug)
    .select('id, slug, name, share_token, owner_id')
    .single()

  if (error) throw error
  if (!data.share_token) throw new Error('Kunde inte skapa delningslänk')

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    shareToken: data.share_token,
    ownerId: data.owner_id ?? null,
  }
}

export function shareUrlForToken(token: string): string {
  return `${window.location.origin}/dela/${token}`
}
