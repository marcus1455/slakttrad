import { supabase } from './supabase'

const BUCKET = 'person-photos'

async function uploadPhoto(path: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Välj en bildfil (jpg, png, webp…)')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Bilden får max vara 5 MB')
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  })

  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadPersonPhoto(
  treeSlug: string,
  personId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${treeSlug}/${personId}/${Date.now()}.${ext}`
  return uploadPhoto(path, file)
}

export async function uploadAccountAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `accounts/${userId}/${Date.now()}.${ext}`
  return uploadPhoto(path, file)
}

export async function uploadTreeCover(treeSlug: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `covers/${treeSlug}/${Date.now()}.${ext}`
  return uploadPhoto(path, file)
}

export async function removePersonPhoto(photoUrl: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`
  const idx = photoUrl.indexOf(marker)
  if (idx === -1) return
  const path = photoUrl.slice(idx + marker.length)
  await supabase.storage.from(BUCKET).remove([path])
}
