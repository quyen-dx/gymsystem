import { Card, Empty, List, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

export default function MyActivityPage() {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<any[]>([])
  useEffect(() => { systemExperienceService.getMyActivity().then((res) => setItems(res.data.activities || [])) }, [])
  return (
    <MemberLayout>
      <div className="member-page">
        <Card title={t('system_experience.activity.title')}>
          {items.length === 0 ? <Empty description={t('system_experience.activity.empty')} /> : <List dataSource={items} renderItem={(item) => <List.Item><List.Item.Meta title={<span>{item.title} <Tag>{item.type}</Tag></span>} description={`${item.description || ''} • ${new Date(item.createdAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}`} /></List.Item>} />}
        </Card>
      </div>
    </MemberLayout>
  )
}
