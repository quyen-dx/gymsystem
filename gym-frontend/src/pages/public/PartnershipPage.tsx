import { Card } from 'antd'
import PartnershipRequestForm from '../../components/partnership/PartnershipRequestForm'

export default function PartnershipPage() {
  return (
    <main className="min-h-dvh bg-[var(--theme-bg)] px-4 py-6 text-[var(--theme-text)] sm:py-10">
      <div className="mx-auto grid max-w-6xl grid-cols-[0.9fr_1.1fr] gap-6 sm:gap-8 max-[860px]:grid-cols-1">
        <section className="flex flex-col justify-center">
          <div className="mb-6 flex items-center gap-4">
            <div className="h-14 w-1.5 rounded-full bg-[var(--theme-accent)]" />
            <h1 className="m-0 text-4xl font-semibold leading-tight sm:text-5xl max-[640px]:text-3xl">
              Hợp tác cùng GymPro
            </h1>
          </div>
          <p className="text-base leading-7 text-[var(--theme-muted)] sm:text-lg sm:leading-8">
            Đưa thương hiệu của bạn đến cộng đồng tập luyện GymPro, tiếp cận khách hàng có nhu cầu thực tế về thiết bị, dinh dưỡng, trang phục và phụ kiện thể thao.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-[var(--theme-muted)] sm:mt-8">
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
