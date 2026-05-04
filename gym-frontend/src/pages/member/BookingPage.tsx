
import MemberLayout from '../../components/layout/MemberLayout'

export default function BookingPage() {
  return (
    <MemberLayout>
      <div className="member-page mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8 max-[640px]:p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Module 5</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Đặt lịch tập </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Chức năng đang phát triển — Phụ trách: Thành viên 5
        </p>
      </div>
    </MemberLayout>
  )
}
