import { Select } from 'antd'
import { useTranslation } from 'react-i18next'

const languageOptions = [
  {
    value: 'vi',
    label: (
      <span className="inline-flex items-center gap-2">
        <img src="https://flagcdn.com/16x12/vn.png" alt="" className="h-3 w-auto" />
        Vietnamese
      </span>
    ),
  },
  {
    value: 'en',
    label: (
      <span className="inline-flex items-center gap-2">
        <img src="https://flagcdn.com/16x12/us.png" alt="" className="h-3 w-auto" />
        English
      </span>
    ),
  },
]

export default function LanguageSelect({ className }: { className?: string }) {
  const { i18n } = useTranslation()
  const currentLanguage = i18n.language?.startsWith('vi') ? 'vi' : 'en'

  return (
    <Select
      value={currentLanguage}
      onChange={(value) => i18n.changeLanguage(value)}
      className={className}
      style={{ width: 142 }}
      popupMatchSelectWidth={false}
      options={languageOptions}
    />
  )
}
