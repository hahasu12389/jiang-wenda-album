import { Routes, Route, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import ConfigWarning from './components/ConfigWarning'
import Layout from './components/Layout'
import Home from './pages/Home'
import AlbumPage from './pages/AlbumPage'
import Login from './admin/Login'
import AdminRoute from './admin/AdminRoute'
import AdminShell from './admin/AdminShell'
import AdminPhotos from './admin/AdminPhotos'
import AdminSettings from './admin/AdminSettings'

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigWarning />
  }

  return (
    <Routes>
      {/* 公开页面（带导航 / 底部布局） */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/album/:slug" element={<AlbumPage />} />
      </Route>

      {/* 管理员登录 */}
      <Route path="/login" element={<Login />} />

      {/* 管理后台（受保护，含自己的侧边栏布局） */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminShell />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/photos" replace />} />
        <Route path="photos" element={<AdminPhotos />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* 兜底 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
