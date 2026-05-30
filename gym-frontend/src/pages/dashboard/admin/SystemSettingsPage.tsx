import { SaveOutlined } from '@ant-design/icons'
import { Button, Segmented, Spin, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import InlineEditModal, { type EditTarget } from '../../../components/system/InlineEditModal'
import InlineEditPreview from '../../../components/system/InlineEditPreview'
import {
  BUTTON_LINK_FIELDS,
  normalizeSlogan,
  seedLandingForEditor,
  seedSettingsForEditor,
} from '../../../components/system/inlineHomeDefaults'
import { systemExperienceService } from '../../../services/systemExperienceService'
import { normalizeForStorage, normalizeLandingData, normalizeLandingForStorage } from '../../../utils/localization'

export default function SystemSettingsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewLang, setPreviewLang] = useState<'vi' | 'en'>('vi')
  const [landingData, setLandingData] = useState<any>({})
  const [settingsData, setSettingsData] = useState<any>({})
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      systemExperienceService.getSettings(),
      systemExperienceService.getCmsPage('home'),
    ])
      .then(([settingsRes, landingRes]) => {
        const settings = seedSettingsForEditor(settingsRes.data.settings || {}, t)
        const landing = seedLandingForEditor(normalizeLandingData(landingRes.data.landing || {}), t)
        setSettingsData(settings)
        setLandingData(landing)
      })
      .catch(() => message.error(t('system_experience.admin.load_failed')))
      .finally(() => setLoading(false))
  }, [t])

  const handleEdit = useCallback((target: EditTarget) => {
    setEditTarget(target)
    setModalOpen(true)
  }, [])

  const getEditValue = useCallback(() => {
    if (!editTarget) return null

    if (editTarget.field === 'slogans') {
      return (settingsData.slogans || []).map(normalizeSlogan)
    }

    if (editTarget.index != null) {
      const list = landingData?.[editTarget.field]
      return Array.isArray(list) ? list[editTarget.index] : null
    }

    if (editTarget.sub === 'button') {
      const linkField = BUTTON_LINK_FIELDS[editTarget.field]
      return {
        text: normalizeForStorage(landingData?.[editTarget.field]),
        link: landingData?.[linkField] || '',
        variant: 'primary',
      }
    }

    return normalizeForStorage(landingData?.[editTarget.field])
  }, [editTarget, landingData, settingsData])

  const handleEditChange = useCallback((newVal: any) => {
    if (!editTarget) return

    if (editTarget.field === 'slogans') {
      const slogans = (newVal || []).map(normalizeSlogan)
      setSettingsData((prev: any) => ({ ...prev, slogans }))
      return
    }

    setLandingData((prev: any) => {
      const next = { ...prev }

      if (editTarget.index != null) {
        const list = Array.isArray(next[editTarget.field]) ? [...next[editTarget.field]] : []
        list[editTarget.index] = { ...list[editTarget.index], ...newVal }
        next[editTarget.field] = list
        return next
      }

      if (editTarget.sub === 'button') {
        next[editTarget.field] = normalizeForStorage(newVal?.text)
        const linkField = BUTTON_LINK_FIELDS[editTarget.field]
        if (linkField && newVal?.link !== undefined) next[linkField] = newVal.link
        return next
      }

      next[editTarget.field] = normalizeForStorage(newVal)
      return next
    })
  }, [editTarget])

  const handleAdd = useCallback((field: 'stats' | 'services' | 'testimonials') => {
    setLandingData((prev: any) => {
      const next = { ...prev }
      if (field === 'stats') {
        next.stats = [...(prev.stats || []), { value: '0', label: normalizeForStorage('Mới') }]
      } else if (field === 'services') {
        next.services = [...(prev.services || []), {
          icon: '★',
          title: normalizeForStorage('Dịch vụ mới'),
          description: normalizeForStorage('Mô tả dịch vụ'),
          color: '#e05a30',
          link: '/',
        }]
      } else {
        next.testimonials = [...(prev.testimonials || []), {
          rating: 5,
          content: normalizeForStorage('Nội dung đánh giá'),
          userName: 'Khách hàng',
          userSubtitle: normalizeForStorage('Hội viên'),
        }]
      }
      return next
    })
  }, [])

  const handleDelete = useCallback((field: 'stats' | 'services' | 'testimonials', index: number) => {
    setLandingData((prev: any) => {
      const list = [...(prev[field] || [])]
      if (list.length <= 1) return prev
      list.splice(index, 1)
      return { ...prev, [field]: list }
    })
  }, [])

  const handleMove = useCallback((field: 'stats' | 'services' | 'testimonials', index: number, direction: 'up' | 'down') => {
    setLandingData((prev: any) => {
      const list = [...(prev[field] || [])]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= list.length) return prev
      const temp = list[index]
      list[index] = list[targetIndex]
      list[targetIndex] = temp
      return { ...prev, [field]: list }
    })
  }, [])

  const submit = async () => {
    const slogans = (settingsData.slogans || [])
      .map(normalizeSlogan)
      .filter((item: any) => item.vi || item.en)

    if (slogans.length === 0) {
      message.error(t('system_experience.admin.slogan_required'))
      return
    }

    setSaving(true)
    try {
      const normalizedLanding = normalizeLandingForStorage(landingData || {})
      const [settingsRes, landingRes] = await Promise.all([
        systemExperienceService.updateSettings({
          ...settingsData,
          slogans,
          slogan: slogans[0]?.vi || slogans[0]?.en || '',
        }),
        systemExperienceService.saveCmsPage('home', normalizedLanding),
      ])

      const savedSettings = seedSettingsForEditor(settingsRes.data.settings || {}, t)
      const savedLanding = seedLandingForEditor(
        normalizeLandingData(landingRes.data.landing || normalizedLanding),
        t,
      )

      setSettingsData(savedSettings)
      setLandingData(savedLanding)
      message.success(t('system_experience.admin.save_success'))
    } catch (error: any) {
      message.error(error.response?.data?.message || t('system_experience.admin.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center"><Spin /></div>
      ) : (
        <div className="flex flex-col gap-0">
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg)]/95 px-1 py-3 backdrop-blur-md">
            <div>
              <h1 className="text-lg font-bold text-[var(--theme-text)]">Inline Home Editor</h1>
              <p className="text-xs text-[var(--theme-muted)]">Click vào phần tử trên preview để chỉnh sửa</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                size="small"
                value={previewLang}
                onChange={(value) => setPreviewLang(value as 'vi' | 'en')}
                options={[{ label: 'VI', value: 'vi' }, { label: 'EN', value: 'en' }]}
              />
              <Button onClick={() => window.open('/', '_blank')}>Mở trang chủ</Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={submit}>
                Lưu thay đổi
              </Button>
            </div>
          </div>

          <div className="w-full overflow-x-hidden">
            <InlineEditPreview
              landing={landingData}
              settings={settingsData}
              language={previewLang}
              onEdit={handleEdit}
              onAdd={handleAdd}
              onDelete={handleDelete}
              onMove={handleMove}
            />
          </div>

          <InlineEditModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            field={editTarget}
            value={getEditValue()}
            onChange={handleEditChange}
          />
        </div>
      )}
    </DashboardLayout>
  )
}
