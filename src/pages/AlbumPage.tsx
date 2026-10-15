import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAlbums, getPhotosByAlbum } from '../lib/api'
import { albumBySlug, PAGE_SIZE } from '../config/site'
import type { Album, PhotoWithUrls } from '../lib/types'
import PhotoGrid from '../components/PhotoGrid'

export default function AlbumPage() {
  const { slug = '' } = useParams()
  const cfg = albumBySlug(slug)

  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<PhotoWithUrls[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 找到数据库相册 id
  useEffect(() => {
    let cancelled = false
    setAlbum(null)
    setPhotos([])
    setPage(0)
    setTotal(0)
    setLoading(true)
    getAlbums()
      .then((list) => {
        if (cancelled) return
        const found = list.find((a) => a.slug === slug)
        setAlbum(found ?? null)
        if (!found) setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [slug])

  // 按页加载
  const loadPage = useCallback(
    async (p: number, replace: boolean) => {
      if (!album) return
      setLoading(true)
      try {
        const { items, count } = await getPhotosByAlbum(album.id, p, PAGE_SIZE)
        setPhotos((prev) => (replace ? items : [...prev, ...items]))
        setTotal(count)
      } catch (e) {
        setError(e instanceof Error ? e.message : '照片加载失败')
      } finally {
        setLoading(false)
      }
    },
    [album]
  )

  useEffect(() => {
    if (album) {
      setPage(0)
      loadPage(0, true)
    }
  }, [album, loadPage])

  // 非法 slug
  if (!cfg) {
    return (
      <div className="container">
        <div className="empty-state" style={{ marginTop: 80 }}>
          <div className="emoji">🧐</div>
          <h3>没有这个相册</h3>
          <Link to="/" className="btn" style={{ marginTop: 16 }}>
            ← 回到首页
          </Link>
        </div>
      </div>
    )
  }

  const hasMore = photos.length < total

  return (
    <div className="container">
      <header className="album-hero">
        <Link to="/" className="back">
          ← 回到首页
        </Link>
        <h1>{cfg.title}</h1>
        <div className="en">{cfg.en}</div>
        <p>{album?.description || cfg.description}</p>
        <div className="total">{total} 张照片 · 按上传时间排序</div>
      </header>

      <section className="section" style={{ paddingTop: 24 }}>
        {error && <div className="error-banner">{error}</div>}

        {!loading && photos.length === 0 && !error ? (
          <div className="empty-state">
            <div className="emoji">{cfg.emoji}</div>
            <h3>这本相册还是空的</h3>
            <p>管理员还没有往「{cfg.title}」里放照片，过阵子再来看看吧 ૮(˶ᵔ ᵕ ᵔ˶)ა</p>
          </div>
        ) : (
          <>
            {photos.length > 0 && <PhotoGrid photos={photos} />}
            {loading && (
              <div className="load-more-wrap">
                <span className="sticker">🐸 正在冲洗照片…</span>
              </div>
            )}
            {!loading && hasMore && (
              <div className="load-more-wrap">
                <button
                  className="btn"
                  onClick={() => {
                    const next = page + 1
                    setPage(next)
                    loadPage(next, false)
                  }}
                >
                  加载更多（还有 {total - photos.length} 张）
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
