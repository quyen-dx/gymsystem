import { Checkbox, Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { systemExperienceService } from '../../services/systemExperienceService'

interface PolicyItem {
  type: string
  label: string
}

interface PolicyConsentCardProps {
  policies: PolicyItem[]
  context: string
  onTickedChange: (ticked: Record<string, { type: string; version: string }>) => void
}

export default function PolicyConsentCard({ policies, context, onTickedChange }: PolicyConsentCardProps) {
  const navigate = useNavigate()
  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const [versions, setVersions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const allTicked = useMemo(
    () => policies.length > 0 && policies.every((p) => ticked[p.type] === true),
    [policies, ticked],
  )

  const typeList = useMemo(() => policies.map((p) => p.type), [policies])

  useEffect(() => {
    setLoading(true)
    systemExperienceService.getConsentStatus(typeList.join(','), context)
      .then((res) => {
        const data = res.data
        const ver: Record<string, string> = {}
        const initial: Record<string, boolean> = {}
        policies.forEach((p) => {
          const info = data[p.type] || {}
          const v = info.currentVersion || ''
          ver[p.type] = v
          initial[p.type] = !!(v && info.accepted === true && info.acceptedContext === context)
        })
        setVersions(ver)
        setTicked(initial)
        if (Object.values(initial).every((v) => v)) {
          const all: Record<string, { type: string; version: string }> = {}
          policies.forEach((p) => {
            all[p.type] = { type: p.type, version: ver[p.type] || '1' }
          })
          onTickedChange(all)
        }
      })
      .catch(() => {
        setVersions({})
        setTicked({})
      })
      .finally(() => setLoading(false))
  }, [context])

  const handleTick = (type: string, checked: boolean) => {
    const next = { ...ticked, [type]: checked }
    setTicked(next)

    const allChecked = policies.every((p) => next[p.type])
    if (allChecked) {
      const all: Record<string, { type: string; version: string }> = {}
      policies.forEach((p) => {
        all[p.type] = { type: p.type, version: versions[p.type] || '1' }
      })
      onTickedChange(all)
    } else {
      onTickedChange({})
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spin size="small" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-4">
      <h4 className="mb-3 text-sm font-semibold text-[var(--theme-text)]">
        {'Xác nhận điều khoản'}
      </h4>
      <div className="space-y-2">
        {policies.map((policy) => {
          const version = versions[policy.type] || ''
          const isTicked = ticked[policy.type] || false
          return (
            <div
              key={policy.type}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                isTicked
                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                  : 'border-[var(--theme-border)] bg-[var(--theme-card)]'
              }`}
            >
              <Checkbox
                checked={isTicked}
                onChange={(e) => handleTick(policy.type, e.target.checked)}
              />
              <span className="flex-1 text-sm text-[var(--theme-text)]">{policy.label}</span>
              {version && (
                <span className="mr-2 text-xs text-[var(--theme-muted)]">v{version}</span>
              )}
              <button
                type="button"
                onClick={() => navigate('/policies')}
                className="text-xs font-medium text-[var(--theme-accent)] hover:underline"
              >
                {'Xem'}
              </button>
            </div>
          )
        })}
      </div>
      {!allTicked && (
        <p className="mt-3 text-xs text-[var(--theme-accent)]">
          {'Bạn cần xác nhận đủ các chính sách bắt buộc trước khi tiếp tục.'}
        </p>
      )}
    </div>
  )
}
