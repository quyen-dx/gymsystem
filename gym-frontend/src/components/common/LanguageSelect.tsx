import { useTranslation } from 'react-i18next'

export default function LanguageSelect() {
  const { i18n } = useTranslation()

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => i18n.changeLanguage('vi')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
          i18n.language === 'vi'
            ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]'
            : 'text-[var(--gs-muted)] hover:text-[var(--theme-accent)]'
        }`}
      >
        <img src="https://flagcdn.com/20x15/vn.png" alt="" className="h-3.5 w-5 rounded-sm object-cover" />
        VN
      </button>
      <button
        type="button"
        onClick={() => i18n.changeLanguage('en')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
          i18n.language === 'en'
            ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]'
            : 'text-[var(--gs-muted)] hover:text-[var(--theme-accent)]'
        }`}
      >
        <img src="https://flagcdn.com/20x15/us.png" alt="" className="h-3.5 w-5 rounded-sm object-cover" />
        EN
      </button>
    </div>
  )
}
