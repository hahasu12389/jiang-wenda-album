import { useEffect, useRef, useState } from 'react'
import { getSettings, updateSettings, uploadHeroCover, publicUrl } from '../lib/api'
import { DEFAULT_SITE } from '../config/site'

export default function AdminSettings() {
  const [form, setForm] = useState({
    site_name: DEFAULT_SITE.name,
    nickname: DEFAULT_SITE.nickname,
    bio: DEFAULT_SITE.bio,
    hero_title: DEFAULT_SITE.heroTitle,
    hero_subtitle: DEFAULT_SITE.heroSubtitle,
    hero_intro: DEFAULT_SITE.heroIntro,
    footer_text: DEFAULT_SITE.footerText,
  })
  const [heroCoverPath, setHeroCoverPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (!s) return
        setForm({
          site_name: s.site_name,
          nickname: s.nickname,
          bio: s.bio || '',
          hero_title: s.hero_title,
          hero_subtitle: s.hero_subtitle || '',
          hero_intro: s.hero_intro || '',
          footer_text: s.footer_text || '',
        })
        setHeroCoverPath(s.hero_cover_path)
      })
      .catch(() => setMsg({ type: 'err', text: '设置加载失败，请检查数据库与 RLS。' }))
      .finally(() => setLoading(false))
  }, [])

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    window.setTimeout(() => setMsg(null), 4000)
  }

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateSettings(form)
      flash('ok', '设置已保存到云端。')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleCover(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      flash('err', '仅支持 JPG / PNG / WebP / GIF')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      flash('err', '图片不能超过 20MB')
      return
    }
    try {
      const path = await uploadHeroCover(file)
      await updateSettings({ hero_cover_path: path })
      setHeroCoverPath(path)
      flash('ok', '首页封面已更新。')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : '封面上传失败')
    }
  }

  if (loading) return <p>加载中…</p>

  return (
    <div>
      <h1>⚙️ 网站设置</h1>
      {msg && <div className={msg.type === 'ok' ? 'success-banner' : 'error-banner'}>{msg.text}</div>}

      <div className="form-card" style={{ maxWidth: 720 }}>
        <div className="field">
          <label>网站名称</label>
          <input value={form.site_name} onChange={(e) => set('site_name', e.target.value)} />
        </div>
        <div className="field">
          <label>朋友昵称</label>
          <input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} />
        </div>
        <div className="field">
          <label>个人简介</label>
          <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} />
        </div>
        <div className="field">
          <label>首页大标题</label>
          <input value={form.hero_title} onChange={(e) => set('hero_title', e.target.value)} />
        </div>
        <div className="field">
          <label>英文副标题</label>
          <input value={form.hero_subtitle} onChange={(e) => set('hero_subtitle', e.target.value)} />
        </div>
        <div className="field">
          <label>首页介绍文字</label>
          <textarea value={form.hero_intro} onChange={(e) => set('hero_intro', e.target.value)} />
        </div>
        <div className="field">
          <label>底部纪念文字</label>
          <input value={form.footer_text} onChange={(e) => set('footer_text', e.target.value)} />
        </div>

        <div className="field">
          <label>首页封面照片</label>
          {heroCoverPath && (
            <img
              src={publicUrl(heroCoverPath)}
              alt="首页封面"
              style={{ width: 160, height: 200, objectFit: 'cover', border: '1.5px solid var(--line)', marginBottom: 10 }}
            />
          )}
          <div>
            <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
              更换首页封面
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleCover(f)
                e.target.value = ''
              }}
            />
          </div>
          <div className="hint">建议竖版 4:5 比例，上传前会自动压缩。</div>
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存全部设置'}
        </button>
      </div>
    </div>
  )
}
