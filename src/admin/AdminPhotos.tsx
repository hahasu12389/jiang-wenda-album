import { useEffect, useRef, useState } from 'react'
import {
  getAlbums,
  getAllPhotos,
  uploadPhoto,
  updatePhoto,
  deletePhotos,
  setAlbumCover,
  reorderPhoto,
} from '../lib/api'
import type { Album, PhotoWithUrls } from '../lib/types'

interface PendingFile {
  file: File
  previewUrl: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  message?: string
}

interface EditDraft {
  id: string
  title: string
  description: string
  photoDate: string
  albumId: string
}

export default function AdminPhotos() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [photos, setPhotos] = useState<PhotoWithUrls[]>([])
  const [filter, setFilter] = useState<string>('') // album id
  const [loading, setLoading] = useState(false)
  const [globalMsg, setGlobalMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 上传表单
  const [pending, setPending] = useState<PendingFile[]>([])
  const [targetAlbumId, setTargetAlbumId] = useState('')
  const [title, setTitle] = useState('')
  const [photoDate, setPhotoDate] = useState('')
  const [description, setDescription] = useState('')
  const [isCover, setIsCover] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 批量选择
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<PhotoWithUrls[] | null>(null)

  // 编辑
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const [albumList, photoList] = await Promise.all([getAlbums(), getAllPhotos(filter || undefined)])
      setAlbums(albumList)
      setPhotos(photoList)
      if (!targetAlbumId && albumList[0]) setTargetAlbumId(albumList[0].id)
    } catch (e) {
      flash('err', e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  function flash(type: 'ok' | 'err', text: string) {
    setGlobalMsg({ type, text })
    window.setTimeout(() => setGlobalMsg(null), 5000)
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const valid: PendingFile[] = []
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    Array.from(fileList).forEach((file) => {
      if (!allowed.includes(file.type)) {
        flash('err', `已忽略不支持的文件：${file.name}`)
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        flash('err', `已忽略超过 20MB 的文件：${file.name}`)
        return
      }
      valid.push({ file, previewUrl: URL.createObjectURL(file), status: 'pending' })
    })
    setPending((prev) => [...prev, ...valid])
  }

  function removePending(index: number) {
    setPending((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleUpload() {
    if (!targetAlbumId) {
      flash('err', '请先选择照片分类。')
      return
    }
    if (pending.length === 0) {
      flash('err', '请先选择至少一张照片。')
      return
    }
    const todo = pending.filter((p) => p.status === 'pending')
    for (let i = 0; i < todo.length; i++) {
      const item = todo[i]
      setPending((prev) =>
        prev.map((p) => (p === item ? { ...p, status: 'uploading', message: `上传中 ${i + 1}/${todo.length}` } : p))
      )
      try {
        // 仅第一张使用表单里填写的统一信息；其余只设置分类与封面逻辑
        await uploadPhoto(
          targetAlbumId,
          item.file,
          i === 0
            ? { title, description, photoDate, isCover }
            : { title: '', description: '', photoDate: '', isCover: false }
        )
        setPending((prev) => prev.map((p) => (p === item ? { ...p, status: 'done' } : p)))
      } catch (e) {
        setPending((prev) =>
          prev.map((p) =>
            p === item
              ? { ...p, status: 'error', message: e instanceof Error ? e.message : '上传失败' }
              : p
          )
        )
      }
    }
    // 清理已成功项，保留失败项供重试
    setPending((prev) => {
      const failed = prev.filter((p) => p.status !== 'done')
      prev.filter((p) => p.status === 'done').forEach((p) => URL.revokeObjectURL(p.previewUrl))
      return failed
    })
    setTitle('')
    setDescription('')
    setPhotoDate('')
    setIsCover(false)
    await refresh()
    flash('ok', '上传完成，数据已从云端重新读取。')
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDelete(rows: PhotoWithUrls[]) {
    try {
      const { orphaned } = await deletePhotos(rows.map((r) => ({ id: r.id, storage_path: r.storage_path, thumb_path: r.thumb_path })))
      if (orphaned.length > 0) {
        flash('err', `数据库记录已删除，但有 ${orphaned.length} 个存储文件删除失败，可在 Storage 中手动清理或稍后重试。`)
      } else {
        flash('ok', `已删除 ${rows.length} 张照片。`)
      }
      setConfirmDelete(null)
      setSelected(new Set())
      await refresh()
    } catch (e) {
      flash('err', e instanceof Error ? e.message : '删除失败')
    }
  }

  async function handleSaveEdit() {
    if (!editDraft) return
    try {
      await updatePhoto(editDraft.id, {
        title: editDraft.title || null,
        description: editDraft.description || null,
        photo_date: editDraft.photoDate || null,
        album_id: editDraft.albumId,
      })
      setEditDraft(null)
      await refresh()
      flash('ok', '照片信息已更新。')
    } catch (e) {
      flash('err', e instanceof Error ? e.message : '保存失败')
    }
  }

  async function move(photo: PhotoWithUrls, dir: -1 | 1) {
    try {
      await reorderPhoto(photo.id, photo.sort_order + dir)
      await refresh()
    } catch (e) {
      flash('err', e instanceof Error ? e.message : '排序失败')
    }
  }

  const selectedRows = photos.filter((p) => selected.has(p.id))
  const albumName = (id: string) => albums.find((a) => a.id === id)?.title || '—'

  return (
    <div>
      <h1>📷 照片管理</h1>
      {globalMsg && (
        <div className={globalMsg.type === 'ok' ? 'success-banner' : 'error-banner'}>{globalMsg.text}</div>
      )}

      {/* 上传区 */}
      <div className="form-card" style={{ marginBottom: 34 }}>
        <h3 style={{ marginBottom: 16 }}>上传新照片</h3>
        <div
          className={`dragzone ${dragOver ? 'drag' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            addFiles(e.dataTransfer.files)
          }}
        >
          <div className="big">🗂️</div>
          <div>点击选择照片，或把图片拖到这里（支持电脑文件夹 / 手机相册，可多选）</div>
          <div className="hint" style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
            支持 JPG / PNG / WebP / GIF，单张 ≤ 20MB，上传前会自动压缩并生成缩略图
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {pending.length > 0 && (
          <div className="upload-preview">
            {pending.map((p, i) => (
              <div key={p.previewUrl} className="item">
                <img src={p.previewUrl} alt="预览" />
                {p.status === 'uploading' && <div className="progress">{p.message}</div>}
                {p.status === 'error' && (
                  <div className="progress" style={{ background: 'rgba(247,227,222,.92)', color: 'var(--danger)', fontSize: 12 }}>
                    失败：{p.message}
                  </div>
                )}
                {p.status === 'done' && <div className="progress">✓</div>}
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  style={{ width: '100%', marginTop: 4 }}
                  onClick={() => removePending(i)}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          <div className="field">
            <label>分类</label>
            <select value={targetAlbumId} onChange={(e) => setTargetAlbumId(e.target.value)}>
              <option value="">请选择分类…</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>标题（可选）</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="给这组照片起个名" />
          </div>
          <div className="field">
            <label>拍摄日期（可选）</label>
            <input type="date" value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>简短描述（可选）</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="isCover"
            type="checkbox"
            checked={isCover}
            onChange={(e) => setIsCover(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <label htmlFor="isCover" style={{ margin: 0 }}>
            将第一张设为该分类封面
          </label>
        </div>
        <button className="btn btn-primary" onClick={handleUpload}>
          ⬆️ 上传 {pending.filter((p) => p.status === 'pending').length} 张照片
        </button>
      </div>

      {/* 管理列表 */}
      <div className="toolbar">
        <h3 style={{ margin: 0, flex: 1 }}>全部照片</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">全部分类</option>
          {albums.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        {selectedRows.length > 0 && (
          <>
            <span style={{ fontSize: 13.5 }}>已选 {selectedRows.length} 张</span>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(selectedRows)}>
              批量删除
            </button>
          </>
        )}
      </div>

      {loading ? (
        <p>加载中…</p>
      ) : photos.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📭</div>
          <h3>还没有照片</h3>
          <p>在上方上传你的第一张照片吧。</p>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={selected.size === photos.length && photos.length > 0}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(photos.map((p) => p.id)) : new Set())
                  }
                />
              </th>
              <th>缩略图</th>
              <th>标题</th>
              <th>分类</th>
              <th>日期</th>
              <th>排序</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {photos.map((p) => (
              <tr key={p.id}>
                <td>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} />
                </td>
                <td>
                  <img className="thumb" src={p.thumbUrl} alt={p.title || '照片'} />
                </td>
                <td>{p.title || <span style={{ color: 'var(--ink-soft)' }}>（无标题）</span>}</td>
                <td>{albumName(p.album_id)}</td>
                <td>{p.photo_date || '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-sm" onClick={() => move(p, 1)} title="提前">
                      ↑
                    </button>
                    <button className="btn btn-sm" onClick={() => move(p, -1)} title="置后">
                      ↓
                    </button>
                  </div>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        const a = albums.find((x) => x.id === p.album_id)
                        if (a?.cover_photo_id === p.id) {
                          flash('ok', '这张已经是该分类封面。')
                          return
                        }
                        setAlbumCover(p.album_id, p.id)
                          .then(() => {
                            refresh()
                            flash('ok', '已设为分类封面。')
                          })
                          .catch((e) => flash('err', e.message))
                      }}
                    >
                      设封面
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() =>
                        setEditDraft({
                          id: p.id,
                          title: p.title || '',
                          description: p.description || '',
                          photoDate: p.photo_date || '',
                          albumId: p.album_id,
                        })
                      }
                    >
                      编辑
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete([p])}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 编辑模态框 */}
      {editDraft && (
        <div className="modal-overlay" onClick={() => setEditDraft(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>编辑照片信息</h3>
            <div className="field">
              <label>标题</label>
              <input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
            </div>
            <div className="field">
              <label>描述</label>
              <textarea
                value={editDraft.description}
                onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label>拍摄日期</label>
              <input
                type="date"
                value={editDraft.photoDate}
                onChange={(e) => setEditDraft({ ...editDraft, photoDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>所属分类</label>
              <select value={editDraft.albumId} onChange={(e) => setEditDraft({ ...editDraft, albumId: e.target.value })}>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => setEditDraft(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除二次确认 */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>确认删除 {confirmDelete.length} 张照片？</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
              将同时删除数据库记录与云端存储文件（含缩略图）。此操作不可恢复，请确认。
            </p>
            <div className="actions">
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
