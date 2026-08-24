import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Input, Radio, Spin } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, SearchOutlined, StarFilled } from '@ant-design/icons'
import { trainerService } from '../../services/trainerService'
import { getUserDisplayName } from '../../utils/userDisplay'
import type { PT } from '../../types/admin/trainer'

interface PreferredTrainerPickerProps {
  value: PT | null
  onChange: (trainer: PT | null) => void
  hint?: ReactNode
  showModeToggle?: boolean
}

function contactOf(t: PT): string {
  if (t.phone) return ' • ' + t.phone
  if (t.email && t.email !== 'undefined') return ' • ' + t.email
  return ''
}

export default function PreferredTrainerPicker({ value, onChange, hint, showModeToggle = true }: PreferredTrainerPickerProps) {
  const [mode, setMode] = useState<'none' | 'specific'>(value || !showModeToggle ? 'specific' : 'none')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PT[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const suppressResetRef = useRef(false)
  const lastSearchRef = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    if (value) {
      setMode('specific')
      setQuery(getUserDisplayName(value, '') + contactOf(value))
    } else if (showModeToggle && !suppressResetRef.current) {
      setMode('none')
    }
    suppressResetRef.current = false
  }, [value, showModeToggle])

  useEffect(() => {
    if (mode === 'specific') {
      const timer = setTimeout(() => openList(), 0)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const doSearch = async (keyword: string) => {
    if (abortRef.current) abortRef.current.abort()
    setLoading(true)
    setOpen(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await trainerService.getPTs({
        ...(keyword.trim() ? { search: keyword.trim() } : {}),
        isActive: true,
        limit: 20,
      })
      if (!controller.signal.aborted) {
        setResults(res.data.pts || [])
        setOpen(true)
      }
    } catch {
      if (!controller.signal.aborted) setResults([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const openList = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(true)
    const key = query.trim()
    const now = Date.now()
    if (lastSearchRef.current?.key === key && now - lastSearchRef.current.at < 500) return
    lastSearchRef.current = { key, at: now }
    doSearch(query)
  }

  const handleQueryChange = (v: string) => {
    setQuery(v)
    if (value) {
      suppressResetRef.current = true
      onChange(null)
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(v), 300)
  }

  const selectTrainer = (t: PT) => {
    onChange(t)
    setQuery(getUserDisplayName(t, '') + contactOf(t))
    setOpen(false)
  }

  const clearSelection = () => {
    onChange(null)
    setMode(showModeToggle ? 'none' : 'specific')
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="space-y-3">
      {showModeToggle && (
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
          <div className="flex flex-col gap-2">
            <Radio value="none">
              <span className="text-sm">Không yêu cầu PT cụ thể</span>
            </Radio>
            <Radio value="specific">
              <span className="text-sm">Có PT mong muốn</span>
            </Radio>
          </div>
        </Radio.Group>
      )}

      {mode === 'specific' && (
        <div ref={wrapRef} className="relative">
          <div className={`relative rounded-2xl border bg-[var(--gs-card)] px-1.5 py-1 shadow-sm transition-colors ${
            open ? 'border-[var(--theme-accent)] ring-2 ring-[var(--theme-accent-muted)]' : 'border-[var(--theme-border)]'
          }`}>
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={openList}
              onClick={openList}
              placeholder="Nhập tên PT bạn muốn tập cùng..."
              prefix={<SearchOutlined style={{ color: 'var(--gs-text-muted)' }} />}
              suffix={
                value && query ? (
                  <CloseCircleFilled
                    style={{ color: 'var(--gs-text-muted)', cursor: 'pointer' }}
                    onClick={clearSelection}
                  />
                ) : loading ? (
                  <Spin size="small" />
                ) : null
              }
              className="!h-10 !border-0 !bg-transparent !shadow-none"
            />
          </div>

          {value && !open && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] px-3 py-2.5">
              <Avatar src={value.avatar} size={34} className="shrink-0">
                {getUserDisplayName(value, 'PT').charAt(0)}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--gs-text)]">
                  <CheckCircleFilled className="text-[var(--theme-accent)]" />
                  <span className="truncate">Đã chọn {getUserDisplayName(value, 'PT')}</span>
                </div>
                {value.specialties?.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-[var(--gs-text-muted)]">{value.specialties.slice(0, 3).join(' • ')}</p>
                )}
              </div>
              <button type="button" onClick={openList} className="shrink-0 text-xs font-medium text-[var(--theme-accent)] hover:underline">
                Đổi PT
              </button>
            </div>
          )}

          {open && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--gs-text)]">Chọn huấn luyện viên</span>
                {!loading && <span className="text-xs text-[var(--gs-text-muted)]">{results.length} PT phù hợp</span>}
              </div>
              <div className="max-h-[320px] overflow-y-auto p-2">
              {loading && results.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <Spin size="small" />
                </div>
              ) : results.length === 0 ? (
                <div className="py-6 text-center text-sm text-[var(--gs-text-muted)]">
                  Không tìm thấy PT phù hợp.
                </div>
              ) : (
                results.map((t) => (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => selectTrainer(t)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors last:mb-0 hover:bg-[var(--gs-active-bg)] ${
                      value?._id === t._id ? 'bg-[var(--theme-accent-muted)] ring-1 ring-[var(--theme-accent)]' : ''
                    }`}
                  >
                    <Avatar src={t.avatar} size={42} className="shrink-0">
                      {getUserDisplayName(t, 'PT').charAt(0)}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--gs-text)]">{getUserDisplayName(t)}</span>
                        {value?._id === t._id && <CheckCircleFilled className="shrink-0 text-[var(--theme-accent)]" />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--gs-text-muted)]">
                        {t.specialties?.length > 0 && (
                          <span className="max-w-[210px] truncate">{t.specialties.slice(0, 3).join(' • ')}</span>
                        )}
                        {Number(t.rating || 0) > 0 && (
                          <span className="inline-flex items-center gap-1"><StarFilled className="text-amber-400" />{Number(t.rating).toFixed(1)}</span>
                        )}
                        {Number(t.experienceYears || 0) > 0 && <span>{t.experienceYears} năm kinh nghiệm</span>}
                      </div>
                    </div>
                  </button>
                ))
              )}
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-[var(--gs-text-muted)]">
            {hint || 'Nếu PT bạn chọn không phù hợp hoặc không có lịch trống, Admin vẫn có thể phân công PT khác phù hợp hơn.'}
          </p>
        </div>
      )}
    </div>
  )
}
