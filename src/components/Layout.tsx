import { Outlet, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getSettings } from '../lib/api'
import { DEFAULT_SITE } from '../config/site'
import type { SiteSettings } from '../lib/types'

export default function Layout() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {
        // 读取失败时使用默认文案，不阻塞页面
      })
  }, [])

  const siteName = settings?.site_name || DEFAULT_SITE.name
  const footer = settings?.footer_text || DEFAULT_SITE.footerText

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="brand">
            <span className="frog">🐸</span>
            {siteName}
          </NavLink>
          <div className="nav-links">
            <NavLink to="/album/life">LIFE</NavLink>
            <NavLink to="/album/campus">CAMPUS</NavLink>
            <NavLink to="/album/food">FOOD</NavLink>
            <NavLink to="/album/travel">TRAVEL</NavLink>
          </div>
        </div>
      </nav>

      <main>
        <Outlet context={{ settings }} />
      </main>

      <footer className="footer">
        <div className="kao">(｡･ω･｡)ﾉ♡</div>
        <div>{footer}</div>
      </footer>
    </>
  )
}
