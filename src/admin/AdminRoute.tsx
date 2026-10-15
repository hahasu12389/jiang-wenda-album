import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// 路由守卫：
//  - 加载中：显示等待
//  - 未登录 / 已登录但非管理员：跳到 /login
//  注意：即使绕过这里，RLS 也会在服务端拒绝所有写操作。
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <span className="sticker">🐸 正在确认身份…</span>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
