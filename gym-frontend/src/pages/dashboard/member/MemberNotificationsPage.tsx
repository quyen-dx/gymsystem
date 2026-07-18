import MemberLayout from '../../../components/layout/header/MemberLayout'
import NotificationCenter from '../../../components/notifications/NotificationCenter'

export default function MemberNotificationsPage() {
  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-[var(--gs-text)]">Thông báo</h1>
        <NotificationCenter role="member" />
      </div>
    </MemberLayout>
  )
}
