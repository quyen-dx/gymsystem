import React from 'react'

type LanguageSectionProps = {
  language: 'vi' | 'en'
  children: React.ReactNode
  title?: string
}

/**
 * Reusable component for language-specific sections in editors.
 * Provides distinct styling for Vietnamese and English fields.
 */
export default function LanguageSection({ language, children, title }: LanguageSectionProps) {
  const isVi = language === 'vi'
  const defaultTitle = isVi ? '🇻🇳 Tiếng Việt' : '🇺🇸 English'

  return (
    <div className={`language-section language-section--${language}`}>
      <div className="language-section__header">
        {title || defaultTitle}
      </div>
      <div className="language-section__content">
        {children}
      </div>
    </div>
  )
}
