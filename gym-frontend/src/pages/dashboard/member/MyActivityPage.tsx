import { Card, Empty, List, Tag } from 'antd'
import { useEffect, useState } from 'react'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

export default function MyActivityPage() {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => { systemExperienceService.getMyActivity().then((res) => setItems(res.data.activities || [])) }, [])
  return (
    <MemberLayout>
      <div className="member-page">
        <Card title="Hoạt động của tôi">
          {items.length === 0 ? <Empty description="Chưa có hoạt động nào" /> : <List dataSource={items} renderItem={(item) => <List.Item><List.Item.Meta title={<span>{item.title} <Tag>{item.type}</Tag></span>} description={`${item.description || ''} • ${new Date(item.createdAt).toLocaleString('vi-VN')}`} /></List.Item>} />}
        </Card>
      </div>
    </MemberLayout>
  )
}
