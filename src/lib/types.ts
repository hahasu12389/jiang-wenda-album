// 数据库表结构对应的前端类型（与 SQL 脚本保持一致）

export interface Album {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  cover_photo_id: string | null
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  album_id: string
  // Storage 中原图路径
  storage_path: string
  // Storage 中缩略图路径（可空，兼容旧数据）
  thumb_path: string | null
  title: string | null
  description: string | null
  photo_date: string | null
  sort_order: number
  width: number | null
  height: number | null
  created_at: string
  updated_at: string
}

export interface SiteSettings {
  id: number
  site_name: string
  nickname: string
  bio: string | null
  hero_title: string
  hero_subtitle: string | null
  hero_intro: string | null
  hero_cover_path: string | null
  footer_text: string | null
  updated_at: string
}

// 照片在前端使用时附带的可访问 URL
export interface PhotoWithUrls extends Photo {
  url: string
  thumbUrl: string
  album?: Album
}
