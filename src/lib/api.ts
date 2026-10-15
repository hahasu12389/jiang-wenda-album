import { supabase } from './supabase'
import { STORAGE_BUCKET, ALBUMS } from '../config/site'
import type { Album, Photo, SiteSettings, PhotoWithUrls } from './types'
import { processImage, safeFileName, thumbPathOf } from './image'

// ============================================================
//  数据访问层。
//  所有访问都通过 anon key 调用 Supabase，
//  真正的权限由数据库 RLS + Storage 策略在服务端强制。
//  前端“隐藏按钮”只是体验，不是安全边界。
// ============================================================

// ---------- 公开 URL ----------
export function publicUrl(storagePath: string | null): string {
  if (!storagePath) return ''
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export function withUrls(photo: Photo): PhotoWithUrls {
  const thumb = photo.thumb_path ? publicUrl(photo.thumb_path) : publicUrl(photo.storage_path)
  return { ...photo, url: publicUrl(photo.storage_path), thumbUrl: thumb }
}

// ---------- 网站设置 ----------
export async function getSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data as SiteSettings | null
}

// ---------- 相册 ----------
export async function getAlbums(): Promise<Album[]> {
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as Album[]) ?? []
}

// ---------- 照片读取（分页） ----------
export async function getPhotosByAlbum(
  albumId: string,
  page: number,
  pageSize: number
): Promise<{ items: PhotoWithUrls[]; count: number }> {
  const from = page * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await supabase
    .from('photos')
    .select('*', { count: 'exact' })
    .eq('album_id', albumId)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { items: ((data as Photo[]) ?? []).map(withUrls), count: count ?? 0 }
}

// 某分类照片总数（用于首页真实数量）
export async function countPhotosByAlbum(albumId: string): Promise<number> {
  const { count, error } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('album_id', albumId)
  if (error) throw error
  return count ?? 0
}

// 最近上传
export async function getRecentPhotos(limit = 8): Promise<PhotoWithUrls[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data as Photo[]) ?? []).map(withUrls)
}

// 各分类封面照片
export async function getCoverPhoto(coverId: string | null): Promise<Photo | null> {
  if (!coverId) return null
  const { data, error } = await supabase.from('photos').select('*').eq('id', coverId).maybeSingle()
  if (error) return null
  return (data as Photo) ?? null
}

// ---------- 管理员：上传 ----------
export interface UploadMeta {
  title: string
  description: string
  photoDate: string
  isCover: boolean
}

// 上传单张：先存 Storage（原图+缩略图），再写数据库。
// 若数据库写入失败，会尝试回滚已上传的文件，避免孤儿文件。
export async function uploadPhoto(
  albumId: string,
  file: File,
  meta: UploadMeta
): Promise<Photo> {
  const processed = await processImage(file)
  const fullPath = safeFileName(processed.ext, 'full')
  const thumbPath = thumbPathOf(fullPath)

  const fullContentType = processed.ext === 'gif' ? 'image/gif' : 'image/jpeg'

  // 上传原图
  const { error: fullErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fullPath, processed.original, {
      contentType: fullContentType,
      cacheControl: '3600',
      upsert: false,
    })
  if (fullErr) throw new Error(`原图上传失败：${fullErr.message}`)

  // 上传缩略图
  const { error: thumbErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(thumbPath, processed.thumb, {
      contentType: fullContentType,
      cacheControl: '3600',
      upsert: false,
    })
  if (thumbErr) {
    // 回滚原图
    await supabase.storage.from(STORAGE_BUCKET).remove([fullPath])
    throw new Error(`缩略图上传失败：${thumbErr.message}`)
  }

  // 计算排序值：取当前最大 sort_order + 1
  const { data: maxRow } = await supabase
    .from('photos')
    .select('sort_order')
    .eq('album_id', albumId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('photos')
    .insert({
      album_id: albumId,
      storage_path: fullPath,
      thumb_path: thumbPath,
      title: meta.title.trim() || null,
      description: meta.description.trim() || null,
      photo_date: meta.photoDate || null,
      sort_order: nextOrder,
      width: processed.width || null,
      height: processed.height || null,
    })
    .select('*')
    .single()

  if (error) {
    // 数据库写失败，回滚两个 Storage 文件
    await supabase.storage.from(STORAGE_BUCKET).remove([fullPath, thumbPath])
    throw new Error(`照片信息保存失败：${error.message}`)
  }

  // 若勾选作为封面，或该相册还没有封面，则更新封面
  if (meta.isCover) {
    await setAlbumCover(albumId, (data as Photo).id)
  } else {
    await ensureAlbumCover(albumId)
  }

  return data as Photo
}

// ---------- 管理员：修改 ----------
export async function updatePhoto(
  photoId: string,
  patch: Partial<Pick<Photo, 'title' | 'description' | 'photo_date' | 'album_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('photos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', photoId)
  if (error) throw new Error(`更新失败：${error.message}`)
}

// 设置封面
export async function setAlbumCover(albumId: string, photoId: string): Promise<void> {
  const { error } = await supabase
    .from('albums')
    .update({ cover_photo_id: photoId, updated_at: new Date().toISOString() })
    .eq('id', albumId)
  if (error) throw new Error(`封面设置失败：${error.message}`)
}

// 若相册还没有封面，则自动用第一张（幂等，安全）
async function ensureAlbumCover(albumId: string): Promise<void> {
  const { data: album } = await supabase
    .from('albums')
    .select('cover_photo_id')
    .eq('id', albumId)
    .maybeSingle()
  if (album?.cover_photo_id) return
  const { data: first } = await supabase
    .from('photos')
    .select('id')
    .eq('album_id', albumId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (first) await setAlbumCover(albumId, first.id)
}

// 调整顺序：把某张照片移动到指定 sort_order
export async function reorderPhoto(photoId: string, newOrder: number): Promise<void> {
  const { error } = await supabase
    .from('photos')
    .update({ sort_order: newOrder, updated_at: new Date().toISOString() })
    .eq('id', photoId)
  if (error) throw new Error(`排序失败：${error.message}`)
}

// ---------- 管理员：删除 ----------
// 先删数据库记录，再删 Storage；Storage 删除失败时返回孤儿路径列表，
// 管理后台可提示重试（避免部分失败造成永久不一致）。
export async function deletePhotos(
  photos: Pick<Photo, 'id' | 'storage_path' | 'thumb_path'>[]
): Promise<{ deleted: string[]; orphaned: string[] }> {
  const ids = photos.map((p) => p.id)
  const paths = photos.flatMap((p) =>
    [p.storage_path, p.thumb_path].filter(Boolean) as string[]
  )

  const { error: dbErr } = await supabase.from('photos').delete().in('id', ids)
  if (dbErr) throw new Error(`删除数据库记录失败：${dbErr.message}`)

  // 存储文件删除分批（Supabase 单次上限 1000，这里量小，直接处理）
  const { error: storageErr } = await supabase.storage.from(STORAGE_BUCKET).remove(paths)
  if (storageErr) {
    return { deleted: ids, orphaned: paths }
  }
  return { deleted: ids, orphaned: [] }
}

// 管理员读取全部照片（后台管理）
export async function getAllPhotos(albumId?: string): Promise<PhotoWithUrls[]> {
  let query = supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false })
  if (albumId) query = query.eq('album_id', albumId)
  const { data, error } = await query
  if (error) throw error
  return ((data as Photo[]) ?? []).map(withUrls)
}

// ---------- 管理员：网站设置 ----------
export async function updateSettings(
  patch: Partial<Omit<SiteSettings, 'id' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('site_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw new Error(`设置保存失败：${error.message}`)
}

// 上传首页封面（存储在 site-assets/ 目录）
export async function uploadHeroCover(file: File): Promise<string> {
  const processed = await processImage(file)
  const ext = processed.ext
  const path = `site-assets/hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, processed.original, {
      contentType: ext === 'gif' ? 'image/gif' : 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    })
  if (error) throw new Error(`封面上传失败：${error.message}`)
  return path
}

// 重新导出便于页面使用
export { ALBUMS }
