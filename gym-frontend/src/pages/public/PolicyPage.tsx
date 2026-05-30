import { Card, Empty, List, Spin, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../services/systemExperienceService'

export default function PolicyPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    systemExperienceService.getPolicies().then((res) => setItems(res.data.policies || [])).finally(() => setLoading(false))
  }, [])
  return (
    <MemberLayout>
      <div className="member-page grid gap-5">
        <Card title={t('system_experience.policy.title')} />
        {loading ? <Spin /> : items.length === 0 ? <Empty description={t('system_experience.policy.empty')} /> : (
          <List dataSource={items} renderItem={(item) => (
            <List.Item>
              <Card className="w-full" title={item.title} extra={item.category}>
                <Typography.Paragraph className="whitespace-pre-wrap">{item.content}</Typography.Paragraph>
              </Card>
            </List.Item>
          )} />
        )}
      </div>
    </MemberLayout>
  )
}
