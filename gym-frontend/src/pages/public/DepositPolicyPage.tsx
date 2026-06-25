import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import MemberLayout from '../../components/layout/header/MemberLayout'

const sections = [
  {
    titleKey: 'deposit_policy_page.section_1_title',
    items: [
      'deposit_policy_page.section_1_item_1',
      'deposit_policy_page.section_1_item_2',
      'deposit_policy_page.section_1_item_3',
    ],
  },
  {
    titleKey: 'deposit_policy_page.section_2_title',
    descKey: 'deposit_policy_page.section_2_desc',
    items: [
      'deposit_policy_page.section_2_item_1',
      'deposit_policy_page.section_2_item_2',
      'deposit_policy_page.section_2_item_3',
    ],
  },
  {
    titleKey: 'deposit_policy_page.section_3_title',
    descKey: 'deposit_policy_page.section_3_desc',
    items: [
      'deposit_policy_page.section_3_item_1',
      'deposit_policy_page.section_3_item_2',
      'deposit_policy_page.section_3_item_3',
    ],
  },
  {
    titleKey: 'deposit_policy_page.section_4_title',
    descKey: 'deposit_policy_page.section_4_desc',
    items: [
      'deposit_policy_page.section_4_item_1',
      'deposit_policy_page.section_4_item_2',
      'deposit_policy_page.section_4_item_3',
    ],
  },
  {
    titleKey: 'deposit_policy_page.section_5_title',
    descKey: 'deposit_policy_page.section_5_desc',
    items: [
      'deposit_policy_page.section_5_item_1',
      'deposit_policy_page.section_5_item_2',
      'deposit_policy_page.section_5_item_3',
    ],
  },
]

export default function DepositPolicyPage() {
  const { t } = useTranslation()

  return (
    <MemberLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          to="/deposit"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
        >
          &larr; {t('deposit_policy_page.back')}
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-[var(--theme-text)]">{t('deposit_policy_page.title')}</h1>
        <p className="mb-8 text-sm leading-6 text-[var(--theme-muted)]">{t('deposit_policy_page.description')}</p>

        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div key={idx} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--theme-text)]">{t(section.titleKey)}</h2>
              {section.descKey && (
                <p className="mb-3 text-sm leading-6 text-[var(--theme-text)]">{t(section.descKey)}</p>
              )}
              <ul className="m-0 space-y-2 pl-5 text-sm leading-6 text-[var(--theme-text)]">
                {section.items.map((item, i) => (
                  <li key={i}>{t(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </MemberLayout>
  )
}
