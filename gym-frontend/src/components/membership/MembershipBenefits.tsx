import { CheckCircleFilled } from '@ant-design/icons'
import { QrCode, Dumbbell, Users, UserRound } from 'lucide-react'
import type { PlanFeature } from '../../services/planFeatureService'

const FEATURE_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  QR_CHECKIN: { icon: <QrCode className="w-5 h-5" />, label: 'Check-in QR' },
  CHECK_IN: { icon: <QrCode className="w-5 h-5" />, label: 'Check-in QR' },
  USE_GYM: { icon: <Dumbbell className="w-5 h-5" />, label: 'Sử dụng phòng tập' },
  TRAINING: { icon: <Dumbbell className="w-5 h-5" />, label: 'Sử dụng phòng tập' },
  BOOK_PT_GROUP: { icon: <Users className="w-5 h-5" />, label: 'Đặt lịch PT nhóm' },
  BOOK_PT_PRIVATE: { icon: <UserRound className="w-5 h-5" />, label: 'Đặt lịch PT cá nhân' },
}

const getFeatureIcon = (code?: string) => {
  if (code && FEATURE_ICONS[code]) return FEATURE_ICONS[code].icon
  return <CheckCircleFilled className="text-lg" />
}

const getFeatureName = (feature: PlanFeature) => {
  if (feature.code && FEATURE_ICONS[feature.code]) return FEATURE_ICONS[feature.code].label
  return feature.name
}

type Props = {
  features: PlanFeature[]
}

export default function MembershipBenefits({ features }: Props) {
  if (!features || features.length === 0) return null

  return (
    <div className="mt-6">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--gs-text-soft)]">Quyền lợi</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f._id}
            className="flex items-center gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
              style={{ background: 'var(--theme-accent-muted)', color: 'var(--theme-accent)' }}
            >
              {getFeatureIcon(f.code)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--gs-text)]">{getFeatureName(f)}</div>
              {f.category && (
                <span className="text-xs text-[var(--gs-text-muted)]">{f.category}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}