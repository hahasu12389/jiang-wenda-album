import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAlbums,
  getSettings,
  getRecentPhotos,
  getCoverPhoto,
  countPhotosByAlbum,
  publicUrl,
  withUrls,
} from '../lib/api'
import { ALBUMS, DEFAULT_SITE } from '../config/site'
import type { Album, Photo, SiteSettings, PhotoWithUrls } from '../lib/types'
import SmartImage from '../components/SmartImage'
import PhotoGrid from '../components/PhotoGrid'
import PlaceholderCover from '../components/PlaceholderCover'

interface AlbumCardData {
  slug: string
  title: string
  en: string
  emoji: string
  description: string
  count: number
  coverUrl: string
}

export default function Home() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [cards, setCards] = useState<AlbumCardData[]>([])
  const [recent, setRecent] = useState<PhotoWithUrls[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [s, dbAlbums, recentPhotos] = await Promise.all([
          getSettings().catch(() => null),
          getAlbums().catch(() => [] as Album[]),
          getRecentPhotos(8).catch(() => [] as PhotoWithUrls[]),
        ])

        // 以配置中的四个固定分类为主线，合并数据库中的 id / 封面
        const cardData: AlbumCardData[] = await Promise.all(
          ALBUMS.map(async (cfg) => {
            const db: Album | undefined = dbAlbums.find((a) => a.slug === cfg.slug)
            let count = 0
            let coverUrl = ''
            if (db) {
              const [c, cover] = await Promise.all([
                countPhotosByAlbum(db.id),
                getCoverPhoto(db.cover_photo_id),
              ])
              count = c
              if (cover) coverUrl = withUrls(cover as Photo).thumbUrl
            }
            return {
              slug: cfg.slug,
              title: db?.title || cfg.title,
              en: cfg.en,
              emoji: cfg.emoji,
              description: db?.description || cfg.description,
              count,
              coverUrl,
            }
          })
        )

        if (!cancelled) {
          setSettings(s)
          setCards(cardData)
          setRecent(recentPhotos)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const heroTitle = settings?.hero_title || DEFAULT_SITE.heroTitle
  const heroSubtitle = settings?.hero_subtitle || DEFAULT_SITE.heroSubtitle
  const heroIntro = settings?.hero_intro || DEFAULT_SITE.heroIntro
  const heroCover = settings?.hero_cover_path ? publicUrl(settings.hero_cover_path) : ''

  return (
    <div className="container">
      {/* 主视觉 */}
      <section className="hero">
        <div className="fade-up">
          <div className="hero-kicker">A MEMOIR IN PHOTOGRAPHS · 摄影回忆录</div>
          <h1>{heroTitle}</h1>
          <div className="subtitle">{heroSubtitle}</div>
          <p className="intro">{heroIntro}</p>
          <span className="sticker">呱呱呱 · 欢迎光临 ૮ ˶ᵔ ᵕ ᵔ˶ ა</span>
        </div>
        <div className="hero-cover fade-up">
          <div className="tape" />
          {heroCover ? (
            <SmartImage src={heroCover} alt="封面照片" fallbackEmoji="🐸" />
          ) : (
            <div className="placeholder-cover" style={{ aspectRatio: '4/5' }}>
              <span>🐸</span>
            </div>
          )}
          <div className="kao">(ᵔᴗᵔ)</div>
        </div>
      </section>

      {/* 四个相册入口 */}
      <section className="section">
        <div className="section-head">
          <h2>相册陈列室</h2>
          <span className="en">THE ARCHIVES</span>
        </div>
        <div className="album-grid">
          {cards.map((c) => (
            <Link key={c.slug} to={`/album/${c.slug}`} className="album-card">
              <div className="cover">
                {c.coverUrl ? (
                  <SmartImage src={c.coverUrl} alt={c.title} fallbackEmoji={c.emoji} />
                ) : (
                  <PlaceholderCover emoji={c.emoji} label={c.title} />
                )}
              </div>
              <div className="album-meta">
                <div className="en">
                  <span>{c.emoji}</span> {c.en}
                </div>
                <div className="zh">{c.title}</div>
                <div className="count">
                  {loading ? '加载中…' : `${c.count} 张照片 · 翻开 →`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 最近上传 */}
      <section className="section">
        <div className="section-head">
          <h2>最近洗出来的照片</h2>
          <span className="en">FRESHLY DEVELOPED</span>
        </div>
        {recent.length > 0 ? (
          <PhotoGrid photos={recent} />
        ) : (
          <div className="empty-state">
            <div className="emoji">🫧</div>
            <h3>胶卷还没装</h3>
            <p>管理员上传第一张照片后，这里就会热闹起来。</p>
          </div>
        )}
      </section>
    </div>
  )
}
