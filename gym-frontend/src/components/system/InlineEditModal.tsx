import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, ColorPicker, Input, Modal, Select } from 'antd'
import LanguageSection from './LanguageSection'

export type EditTarget = {
  field: string
  index?: number
  sub?: string
}

const FIELD_TITLES: Record<string, string> = {
  heroBadgeText: 'Sửa badge Hero',
  heroTitle: 'Sửa tiêu đề Hero',
  heroSubtitle: 'Sửa mô tả Hero',
  ctaText: 'Sửa nút CTA',
  secondaryCtaText: 'Sửa nút phụ',
  servicesEyebrow: 'Sửa tiêu đề phụ Dịch vụ',
  servicesTitle: 'Sửa tiêu đề Dịch vụ',
  testimonialsEyebrow: 'Sửa tiêu đề phụ Đánh giá',
  testimonialsTitle: 'Sửa tiêu đề Đánh giá',
  finalCtaTitle: 'Sửa tiêu đề CTA',
  finalCtaSubtitle: 'Sửa mô tả CTA',
  finalCtaPrimaryText: 'Sửa nút chính CTA',
  finalCtaSecondaryText: 'Sửa nút phụ CTA',
  heroImageUrl: 'Sửa ảnh Hero',
  aboutTitle: 'Sửa tiêu đề Giới thiệu',
  aboutContent: 'Sửa nội dung Giới thiệu',
}

const FIELD_TITLES_ARR: Record<string, string> = {
  stats: 'Sửa thống kê',
  services: 'Sửa dịch vụ',
  testimonials: 'Sửa đánh giá',
  slogans: 'Sửa slogan Hero',
  sections: 'Sửa mục giới thiệu',
}

const MODAL_WIDTH = 1100

const selectPopupProps = {
  classNames: { popup: { root: 'inline-edit-select-dropdown' } },
} as const

function getTitle(target: EditTarget) {
  if (target.sub === 'button') {
    return FIELD_TITLES[target.field] || 'Sửa nút'
  }
  if (target.index != null) {
    return FIELD_TITLES_ARR[target.field] || `Sửa ${target.field}`
  }
  return FIELD_TITLES[target.field] || 'Sửa nội dung'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="inline-edit-section-label">{children}</div>
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="inline-edit-field-label">{children}</div>
}

type Props = {
  open: boolean
  onClose: () => void
  field: EditTarget | null
  value: any
  onChange: (newVal: any) => void
}

export default function InlineEditModal({ open, onClose, field, value, onChange }: Props) {
  if (!field) return null

  const title = getTitle(field)

  const renderBody = () => {
    if (field.field === 'slogans') return <SlogansEditor value={value} onChange={onChange} />
    if (field.field === 'stats' && field.index != null) return <StatsEditor value={value} onChange={onChange} />
    if (field.field === 'services' && field.index != null) return <ServicesEditor value={value} onChange={onChange} />
    if (field.field === 'testimonials' && field.index != null) return <TestimonialsEditor value={value} onChange={onChange} />
    if (field.field === 'sections' && field.index != null) return <AboutSectionEditor value={value} onChange={onChange} />
    if (field.sub === 'button') return <ButtonEditor value={value} onChange={onChange} />
    return <LocalizedEditor value={value} onChange={onChange} />
  }

  return (
    <Modal
      className="inline-edit-modal"
      title={<span style={{ fontSize: 18, fontWeight: 800 }}>{title}</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={MODAL_WIDTH}
      destroyOnHidden
      mask={{ closable: true }}
      centered
      styles={{
        container: {
          background: 'var(--theme-card, #111114)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
        },
        header: {
          background: 'var(--theme-card, #111114)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        },
        body: {
          maxHeight: 'calc(88vh - 140px)',
          overflowY: 'auto',
          paddingTop: 4,
          background: 'var(--theme-card, #111114)',
        },
        mask: {
          backdropFilter: 'blur(4px)',
          background: 'rgba(0, 0, 0, 0.65)',
        },
      }}
      style={{ maxWidth: '92vw' }}
    >
      {renderBody()}
      <div className="inline-edit-modal-footer">
        <span className="inline-edit-modal-footer__hint">Thay đổi được cập nhật realtime</span>
        <Button type="primary" className="inline-edit-done-btn" onClick={onClose}>
          Xong
        </Button>
      </div>
    </Modal>
  )
}

function LocalizedEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      return (
        <div>
          <FieldLabel>Nội dung</FieldLabel>
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      )
    }
    return <div className="inline-edit-empty">Không có dữ liệu</div>
  }
  const hasViEn = 'vi' in value || 'en' in value
  if (!hasViEn) {
    return <div className="inline-edit-empty">Không hỗ trợ chỉnh sửa loại dữ liệu này</div>
  }
  const vi = value.vi ?? ''
  const en = value.en ?? ''
  const isLongText = (vi.length > 80 || en.length > 80)
  const InputComp = isLongText ? Input.TextArea : Input

  return (
    <div className="language-section-grid">
      <LanguageSection language="vi">
        <FieldLabel>Nội dung</FieldLabel>
        <InputComp
          rows={isLongText ? 3 : undefined}
          value={vi}
          onChange={(e) => onChange({ vi: e.target.value, en })}
          placeholder="Nhập nội dung tiếng Việt"
        />
      </LanguageSection>
      <LanguageSection language="en">
        <FieldLabel>Content</FieldLabel>
        <InputComp
          rows={isLongText ? 3 : undefined}
          value={en}
          onChange={(e) => onChange({ vi, en: e.target.value })}
          placeholder="Enter content in English"
        />
      </LanguageSection>
    </div>
  )
}

function ButtonEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const v = value || {}
  const set = (patch: any) => onChange({ ...v, ...patch })

  return (
    <div className="flex flex-col">
      <div className="language-section-grid">
        <LanguageSection language="vi">
          <FieldLabel>Chữ trên nút</FieldLabel>
          <Input
            value={v.text?.vi || ''}
            onChange={(e) => set({ text: { ...v.text, vi: e.target.value, en: v.text?.en || '' } })}
            placeholder="VD: Đặt lịch ngay"
          />
        </LanguageSection>
        <LanguageSection language="en">
          <FieldLabel>Button text</FieldLabel>
          <Input
            value={v.text?.en || ''}
            onChange={(e) => set({ text: { ...v.text, vi: v.text?.vi || '', en: e.target.value } })}
            placeholder="e.g. Book Now"
          />
        </LanguageSection>
      </div>
      
      <div className="px-5 py-4">
        <div className="mb-5">
          <SectionLabel>Liên kết</SectionLabel>
          <FieldLabel>Đường dẫn khi bấm nút</FieldLabel>
          <Input
            value={v.link || ''}
            onChange={(e) => set({ link: e.target.value })}
            placeholder="/booking"
          />
          <div className="inline-edit-hint">
            Internal: /booking, /about, /checkin &nbsp;|&nbsp; External: https://...
          </div>
        </div>
        <div>
          <SectionLabel>Kiểu nút</SectionLabel>
          <Select {...selectPopupProps} value={v.variant || 'primary'} onChange={(v2) => set({ variant: v2 })} style={{ width: '100%' }} popupMatchSelectWidth>
            <Select.Option value="primary">Primary (Nổi bật)</Select.Option>
            <Select.Option value="default">Default (Mặc định)</Select.Option>
            <Select.Option value="outline">Outline (Viền)</Select.Option>
          </Select>
        </div>
      </div>
    </div>
  )
}

function StatsEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const v = value || {}
  const set = (patch: any) => onChange({ ...v, ...patch })

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-0">
        <SectionLabel>Giá trị</SectionLabel>
        <FieldLabel>Số hiển thị (VD: 500+, 98%, 4)</FieldLabel>
        <Input
          value={v.value || ''}
          onChange={(e) => set({ value: e.target.value })}
          placeholder="500+"
        />
      </div>

      <div className="language-section-grid">
        <LanguageSection language="vi">
          <FieldLabel>Nhãn hiển thị</FieldLabel>
          <Input
            value={v.label?.vi || ''}
            onChange={(e) => set({ label: { ...v.label, vi: e.target.value, en: v.label?.en || '' } })}
            placeholder="VD: Hội viên"
          />
        </LanguageSection>
        
        <LanguageSection language="en">
          <FieldLabel>Label</FieldLabel>
          <Input
            value={v.label?.en || ''}
            onChange={(e) => set({ label: { ...v.label, vi: v.label?.vi || '', en: e.target.value } })}
            placeholder="e.g. Members"
          />
        </LanguageSection>
      </div>
    </div>
  )
}

function ServicesEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const v = value || {}
  const set = (patch: any) => onChange({ ...v, ...patch })

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <SectionLabel>Biểu tượng</SectionLabel>
            <Input
              value={v.icon || ''}
              onChange={(e) => set({ icon: e.target.value })}
              placeholder="▣, ◴, ↗, ♡ hoặc emoji"
            />
          </div>
          <div>
            <SectionLabel>Màu</SectionLabel>
            <ColorPicker
              className="services-color-picker"
              format="hex"
              value={v.color || '#e05a30'}
              onChange={(color) => set({ color: color.toHexString() })}
            />
          </div>
        </div>
      </div>

      <div className="language-section-grid">
        <LanguageSection language="vi">
          <FieldLabel>Tiêu đề</FieldLabel>
          <Input
            className="mb-3"
            value={v.title?.vi || ''}
            onChange={(e) => set({ title: { ...v.title, vi: e.target.value, en: v.title?.en || '' } })}
            placeholder="VD: Check-in QR"
          />
          <FieldLabel>Mô tả</FieldLabel>
          <Input.TextArea
            rows={2}
            value={v.description?.vi || ''}
            onChange={(e) => set({ description: { ...v.description, vi: e.target.value, en: v.description?.en || '' } })}
            placeholder="VD: Check-in nhanh bằng mã QR"
          />
        </LanguageSection>

        <LanguageSection language="en">
          <FieldLabel>Title</FieldLabel>
          <Input
            className="mb-3"
            value={v.title?.en || ''}
            onChange={(e) => set({ title: { ...v.title, vi: v.title?.vi || '', en: e.target.value } })}
            placeholder="e.g. QR Check-in"
          />
          <FieldLabel>Description</FieldLabel>
          <Input.TextArea
            rows={2}
            value={v.description?.en || ''}
            onChange={(e) => set({ description: { ...v.description, vi: v.description?.vi || '', en: e.target.value } })}
            placeholder="e.g. Quick check-in with QR code"
          />
        </LanguageSection>
      </div>

      <div className="px-5 pb-5">
        <SectionLabel>Điều hướng</SectionLabel>
        <FieldLabel>Đường dẫn khi bấm vào thẻ</FieldLabel>
        <Input value={v.link || ''} onChange={(e) => set({ link: e.target.value })} placeholder="/checkin" />
      </div>
    </div>
  )
}

function TestimonialsEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const v = value || {}
  const set = (patch: any) => onChange({ ...v, ...patch })

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-0">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <SectionLabel>Khách hàng</SectionLabel>
            <FieldLabel>Tên</FieldLabel>
            <Input value={v.userName || ''} onChange={(e) => set({ userName: e.target.value })} placeholder="VD: Nguyễn Văn A" />
          </div>
          <div>
            <SectionLabel>Đánh giá</SectionLabel>
            <FieldLabel>Số sao</FieldLabel>
            <Select {...selectPopupProps} value={v.rating || 5} onChange={(v2) => set({ rating: v2 })} style={{ width: '100%' }} popupMatchSelectWidth>
              {[1, 2, 3, 4, 5].map((n) => (
                <Select.Option key={n} value={n}>
                  {'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n}/5)
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="language-section-grid">
        <LanguageSection language="vi">
          <FieldLabel>Nội dung đánh giá</FieldLabel>
          <Input.TextArea
            rows={2}
            className="mb-3"
            value={v.content?.vi || ''}
            onChange={(e) => set({ content: { ...v.content, vi: e.target.value, en: v.content?.en || '' } })}
            placeholder="VD: Phòng gym hiện đại, huấn luyện viên nhiệt tình"
          />
          <FieldLabel>Phụ đề (VD: Hội viên 2 năm)</FieldLabel>
          <Input
            value={v.userSubtitle?.vi || ''}
            onChange={(e) => set({ userSubtitle: { ...v.userSubtitle, vi: e.target.value, en: v.userSubtitle?.en || '' } })}
            placeholder="Hội viên 2 năm"
          />
        </LanguageSection>

        <LanguageSection language="en">
          <FieldLabel>Review content</FieldLabel>
          <Input.TextArea
            rows={2}
            className="mb-3"
            value={v.content?.en || ''}
            onChange={(e) => set({ content: { ...v.content, vi: v.content?.vi || '', en: e.target.value } })}
            placeholder="e.g. Modern gym, enthusiastic trainers"
          />
          <FieldLabel>Subtitle (e.g. Member for 2 years)</FieldLabel>
          <Input
            value={v.userSubtitle?.en || ''}
            onChange={(e) => set({ userSubtitle: { ...v.userSubtitle, vi: v.userSubtitle?.vi || '', en: e.target.value } })}
            placeholder="Member for 2 years"
          />
        </LanguageSection>
      </div>
    </div>
  )
}

function AboutSectionEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const v = value || {}
  const set = (patch: any) => onChange({ ...v, ...patch })

  return (
    <div className="flex flex-col">
      <div className="language-section-grid">
        <LanguageSection language="vi">
          <FieldLabel>Tiêu đề</FieldLabel>
          <Input
            className="mb-3"
            value={v.title?.vi || ''}
            onChange={(e) => set({ title: { ...v.title, vi: e.target.value, en: v.title?.en || '' } })}
            placeholder="VD: Lịch sử phát triển"
          />
          <FieldLabel>Nội dung</FieldLabel>
          <Input.TextArea
            rows={3}
            value={v.content?.vi || ''}
            onChange={(e) => set({ content: { ...v.content, vi: e.target.value, en: v.content?.en || '' } })}
            placeholder="VD: GymPro được thành lập từ năm 2010..."
          />
        </LanguageSection>
        <LanguageSection language="en">
          <FieldLabel>Title</FieldLabel>
          <Input
            className="mb-3"
            value={v.title?.en || ''}
            onChange={(e) => set({ title: { ...v.title, vi: v.title?.vi || '', en: e.target.value } })}
            placeholder="e.g. Our History"
          />
          <FieldLabel>Content</FieldLabel>
          <Input.TextArea
            rows={3}
            value={v.content?.en || ''}
            onChange={(e) => set({ content: { ...v.content, vi: v.content?.vi || '', en: e.target.value } })}
            placeholder="e.g. GymPro was founded in 2010..."
          />
        </LanguageSection>
      </div>
      <div className="px-5 pb-5">
        <SectionLabel>Hình ảnh</SectionLabel>
        <FieldLabel>URL hình ảnh (tùy chọn)</FieldLabel>
        <Input value={v.imageUrl || ''} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://..." />
      </div>
    </div>
  )
}

function SlogansEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const slogans = Array.isArray(value) ? value : []

  const updateSlogan = (index: number, patch: any) => {
    const updated = [...slogans]
    updated[index] = { ...updated[index], ...patch }
    onChange(updated)
  }

  const removeSlogan = (index: number) => {
    const updated = slogans.filter((_, i) => i !== index)
    onChange(updated)
  }

  const addSlogan = () => {
    onChange([...slogans, { vi: '', en: '' }])
  }

  const moveSlogan = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= slogans.length) return
    const updated = [...slogans]
    const temp = updated[fromIdx]
    updated[fromIdx] = updated[toIdx]
    updated[toIdx] = temp
    onChange(updated)
  }

  return (
    <div className="flex flex-col gap-3">
      {slogans.map((slogan: any, idx: number) => (
        <div key={idx} className="inline-edit-slogan-card">
          <div className="inline-edit-slogan-card__header">
            <span className="inline-edit-slogan-card__drag">⋮⋮</span>
            <span className="inline-edit-slogan-card__title">Slogan {idx + 1}</span>
            <Button
              type="text"
              className="inline-edit-delete-btn"
              icon={<DeleteOutlined />}
              onClick={() => removeSlogan(idx)}
              disabled={slogans.length === 1}
            />
          </div>
          <div className="language-section-grid">
            <LanguageSection language="vi">
              <FieldLabel>Tiếng Việt</FieldLabel>
              <Input
                value={slogan.vi || ''}
                onChange={(e) => updateSlogan(idx, { vi: e.target.value })}
                placeholder="Nơi bạn vượt qua giới hạn"
              />
            </LanguageSection>
            <LanguageSection language="en">
              <FieldLabel>English</FieldLabel>
              <Input
                value={slogan.en || ''}
                onChange={(e) => updateSlogan(idx, { en: e.target.value })}
                placeholder="Where you break your limits"
              />
            </LanguageSection>
          </div>
          <div className="inline-edit-slogan-card__actions">
            <Button
              type="text"
              size="small"
              className="inline-edit-move-btn"
              onClick={() => moveSlogan(idx, idx - 1)}
              disabled={idx === 0}
            >
              ↑ Lên
            </Button>
            <Button
              type="text"
              size="small"
              className="inline-edit-move-btn"
              onClick={() => moveSlogan(idx, idx + 1)}
              disabled={idx === slogans.length - 1}
            >
              ↓ Xuống
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={addSlogan}
        className="inline-edit-add-btn"
        block
      >
        Thêm slogan mới
      </Button>
    </div>
  )
}
