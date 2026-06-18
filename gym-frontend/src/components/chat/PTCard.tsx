import { Avatar, Typography, Tag } from 'antd'
import { StarFilled, ExperimentOutlined, CalendarOutlined } from '@ant-design/icons'

const { Text } = Typography

type PTCardItem = {
    name: string
    avatar: string
    phone: string
    email: string
    specialty: string
    experienceYears?: number
    rating?: number
    schedule?: string
    scheduleRaw?: { dayOfWeek: number; shift: string }[]
}

type PTCardProps = {
    item: PTCardItem
    bubbleColor: string
    panelMutedText: string
}

const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 2,
}

const labelStyle = (color: string): React.CSSProperties => ({
    fontSize: 11,
    color,
    minWidth: 40,
    fontWeight: 500,
    flexShrink: 0,
})

const valueStyle = (color: string): React.CSSProperties => ({
    fontSize: 12,
    color,
    lineHeight: '18px',
    wordBreak: 'break-word',
})

export default function PTCard({ item, bubbleColor, panelMutedText }: PTCardProps) {
    const name = item.name || ''
    const phone = item.phone || ''
    const email = item.email || ''
    const specialty = item.specialty || ''
    const rating = item.rating ?? 0
    const experienceYears = item.experienceYears ?? 0
    const schedule = item.schedule || 'Chưa cập nhật'
    const nameInitial = name.charAt(0) || 'PT'

    return (
        <div
            style={{
                display: 'flex',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--theme-card)',
                border: '1px solid var(--theme-border, #e5e7eb)',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Avatar src={item.avatar || undefined} size={64} style={{ border: '2px solid var(--theme-accent)', flexShrink: 0 }}>
                    {nameInitial}
                </Avatar>
                {rating > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <StarFilled style={{ color: '#f59e0b', fontSize: 11 }} />
                        <Text style={{ fontSize: 10, color: bubbleColor, fontWeight: 600 }}>{rating.toFixed(1)}</Text>
                    </div>
                )}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Text strong style={{ color: bubbleColor, fontSize: 14, lineHeight: '20px', marginBottom: 2 }}>
                    {name}
                </Text>

                <div style={rowStyle}>
                    <Text style={labelStyle(panelMutedText)}>SĐT</Text>
                    <Text style={valueStyle(bubbleColor)}>{phone || '---'}</Text>
                </div>

                <div style={rowStyle}>
                    <Text style={labelStyle(panelMutedText)}>Email</Text>
                    <Text style={valueStyle(bubbleColor)}>{email || '---'}</Text>
                </div>

                <div style={rowStyle}>
                    <Text style={labelStyle(panelMutedText)}>Chuyên</Text>
                    <Text style={valueStyle(bubbleColor)}>{specialty || '---'}</Text>
                </div>

                <div style={rowStyle}>
                    <Text style={labelStyle(panelMutedText)}>Lịch</Text>
                    <Text style={valueStyle(bubbleColor)}>{schedule}</Text>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {experienceYears > 0 && (
                        <Tag icon={<ExperimentOutlined />} style={{ fontSize: 10, lineHeight: '16px', margin: 0, borderRadius: 6 }}>
                            {experienceYears} năm KN
                        </Tag>
                    )}
                    {schedule && schedule !== 'Chưa cập nhật' && (
                        <Tag icon={<CalendarOutlined />} style={{ fontSize: 10, lineHeight: '16px', margin: 0, borderRadius: 6 }}>
                            {schedule.length > 20 ? schedule.slice(0, 20) + '...' : schedule}
                        </Tag>
                    )}
                </div>
            </div>
        </div>
    )
}
