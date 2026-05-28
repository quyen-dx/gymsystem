import { Card } from 'antd'
import PartnershipRequestForm from '../../components/partnership/PartnershipRequestForm'

export default function PartnershipPage() {
  return (
    <main className="min-h-screen bg-[var(--theme-bg)] px-4 py-10 text-[var(--theme-text)]">
      <div className="mx-auto grid max-w-6xl grid-cols-[0.9fr_1.1fr] gap-8 max-[860px]:grid-cols-1">
        <section className="flex flex-col justify-center">
          <div className="mb-6 flex items-center gap-4">
            <div className="h-14 w-1.5 rounded-full bg-[var(--theme-accent)]" />
            <h1 className="m-0 text-5xl font-semibold leading-tight max-[640px]:text-3xl">
              Hợp tác cùng GymPro
            </h1>
          </div>
          <p className="text-lg leading-8 text-[var(--theme-muted)]">
            Đưa thương hiệu của bạn đến cộng đồng tập luyện GymPro, tiếp cận khách hàng có nhu cầu thực tế về thiết bị, dinh dưỡng, trang phục và phụ kiện thể thao.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-[var(--theme-muted)]">
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
              Kênh phân phối tập trung vào người tập gym và huấn luyện viên.
            </div>
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4">
              Quy trình duyệt thương hiệu rõ ràng, đội ngũ GymPro phản hồi trong 1-3 ngày làm việc.
            </div>
          </div>
        </section>

        <Card className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
          <PartnershipRequestForm />
        </Card>
      </div>
    </main>
  )
}
