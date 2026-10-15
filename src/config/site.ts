// ============================================================
//  网站文案与默认配置集中管理
//  上线后，管理员可在 /admin/settings 中覆盖这些文案（存云端）。
//  这里的常量是“默认值”，云端 site_settings 为空时使用。
// ============================================================

export const DEFAULT_SITE = {
  // 网站名称
  name: '姜闻达回忆录',
  // 朋友昵称
  nickname: '姜闻达',
  // 个人简介
  bio: '。',
  // 首页主标题
  heroTitle: '姜闻达的78人生',
  // 首页英文副标题
  heroSubtitle: '。。。。。',
  // 首页介绍文字
  heroIntro: '。',
  // 底部纪念文字
  footerText: '© 姜闻达回忆录 · 愿所有瞬间都被温柔以待 (๑•̀ㅂ•́)و',
}

// 四个固定相册分类。slug 与数据库 albums.slug 一一对应。
// 注意：公开页与管理页都依赖这些 slug，不要随意改动。
export const ALBUMS = [
  {
    slug: 'life',
    title: '生活照片',
    en: 'LIFE',
    emoji: '🌿',
    description: '那些没什么大事、却闪闪发亮的日常碎片。',
  },
  {
    slug: 'campus',
    title: '学校照片',
    en: 'CAMPUS',
    emoji: '🎒',
    description: '课桌、操场、走廊，以及一去不返的校园时光。',
  },
  {
    slug: 'food',
    title: '吃饭照片',
    en: 'FOOD',
    emoji: '🍜',
    description: '干饭人的尊严，是认真记录每一顿饭。',
  },
  {
    slug: 'travel',
    title: '旅游照片',
    en: 'TRAVEL',
    emoji: '🧳',
    description: '去没去过的地方，见没见过的云和海。',
  },
] as const

export type AlbumSlug = (typeof ALBUMS)[number]['slug']

export const albumBySlug = (slug: string) => ALBUMS.find((a) => a.slug === slug)

// Storage bucket 名称，需与 SQL 脚本 / Supabase 控制台中创建的一致。
export const STORAGE_BUCKET = 'photos'

// 上传限制
export const UPLOAD_LIMITS = {
  // 单张图片原始文件大小上限（20MB）
  maxFileSize: 20 * 1024 * 1024,
  // 允许的图片类型
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  // 网格缩略图长边像素
  thumbSize: 600,
  // 灯箱 / 大图长边像素
  largeSize: 1920,
  // JPEG/WebP 压缩质量
  quality: 0.82,
}

// 每页展示数量（加载更多）
export const PAGE_SIZE = 12
