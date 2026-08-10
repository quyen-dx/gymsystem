import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Input, Radio, Spin } from 'antd'
import { CloseCircleFilled, SearchOutlined } from '@ant-design/icons'
import { trainerService } from '../../services/trainerService'
import { getUserDisplayName } from '../../utils/userDisplay'
import type { PT } from '../../types/admin/trainer'

interface PreferredTrainerPickerProps {
  value: PT | null
  onChange: (trainer: PT | null) => void
  hint?: ReactNode
}

function contactOf(t: PT): string {
  if (t.phone) return ' • ' + t.phone
  if (t.email && t.email !== 'undefined') return ' • ' + t.email
  return ''
}

export default function PreferredTrainerPicker({ value, onChange, hint }: PreferredTrainerPickerProps) {
  const [mode, setMode] = useState<'none' | 'specific'>(value ? 'specific' : 'none')
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
    } else if (!suppressResetRef.current) {
      setMode('none')
    }
    suppressResetRef.current = false
  }, [value])

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
    setMode('none')
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="space-y-3">
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

      {mode === 'specific' && (
        <div ref={wrapRef} className="relative">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={openList}
              onClick={openList}
              placeholder="Tìm PT theo tên..."
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
              className="!rounded-xl"
            />
          </div>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] shadow-lg max-h-[280px] overflow-y-auto">
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
                  <div
                    key={t._id}
                    onClick={() => selectTrainer(t)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-[var(--gs-active-bg)] ${
                      value?._id === t._id ? 'bg-[var(--theme-accent-muted)]' : ''
                    }`}
                  >
                    <Avatar src={t.avatar} size={36} className="shrink-0">
                      {getUserDisplayName(t, 'PT').charAt(0)}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--gs-text)] truncate">
                        {getUserDisplayName(t)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--gs-text-muted)]">
                        {t.specialties?.length > 0 && (
                          <span>{t.specialties.join(' • ')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
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
