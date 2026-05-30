import { Card, Collapse, Empty, Input, Spin, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../services/systemExperienceService'

export default function HelpCenterPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    systemExperienceService.getFaqs().then((res) => setItems(res.data.faqs || [])).finally(() => setLoading(false))
  }, [])
  const filtered = useMemo(() => items.filter((item) => [item.question, item.answer, item.category].join(' ').toLowerCase().includes(search.toLowerCase())), [items, search])
  return (
    <MemberLayout>
      <div className="member-page grid gap-5">
        <Card title={t('system_experience.help.title')}><Input.Search allowClear placeholder={t('system_experience.help.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} /></Card>
        {loading ? <Spin /> : filtered.length === 0 ? <Empty description={t('system_experience.help.empty')} /> : (
          <Collapse items={filtered.map((item) => ({ key: item._id, label: <span>{item.question} <Tag>{item.category}</Tag></span>, children: <p className="whitespace-pre-wrap">{item.answer}</p> }))} />
        )}
      </div>
    </MemberLayout>
  )
}
