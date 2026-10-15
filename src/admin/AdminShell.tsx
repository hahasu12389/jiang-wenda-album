import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// 后台整体布局（侧边栏 + 内容区）
export default function AdminShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function onSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="admin-layout">
      <aside className="admin-side">
        <div className="logo">🐸 回忆录后台</div>
        <NavLink to="/admin/photos" className={({ isActive }) => (isActive ? 'active' : '')}>
          📷 照片管理
        </NavLink>
        <NavLink to="/admin/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          ⚙️ 网站设置
        </NavLink>
        <NavLink to="/" target="_blank">
          🌐 查看网站
        </NavLink>
        <div className="spacer" />
        <div style={{ fontSize: 12.5, opacity: 0.6, padding: '0 12px', wordBreak: 'break-all' }}>
          {user?.email}
        </div>
        <button
          className="btn btn-sm"
          style={{ marginTop: 10, background: 'transparent', color: 'var(--ivory)', borderColor: 'rgba(255,255,255,.4)' }}
          onClick={onSignOut}
        >
          退出登录
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
