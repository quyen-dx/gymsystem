import { DatePicker, Segmented } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import type { ReportRangeState } from '../../types/report'

const RANGE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Hôm nay', value: 'today' },
  { label: '7 ngày', value: '7d' },
  { label: '30 ngày', value: '30d' },
  { label: 'Quý này', value: 'quarter' },
  { label: 'Năm nay', value: 'year' },
]

interface RangeSelectorProps {
  value: ReportRangeState
  onChange: (value: ReportRangeState) => void
}

export default function RangeSelector({ value, onChange }: RangeSelectorProps) {
  const [customMode, setCustomMode] = useState(value.value === 'custom')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        size="middle"
        value={value.value}
        onChange={(val) => {
          const v = val as string
          if (v === 'custom') {
            setCustomMode(true)
            return
          }
          setCustomMode(false)
          onChange({ value: v as ReportRangeState['value'] })
        }}
        options={[...RANGE_OPTIONS, { label: 'Tùy chọn', value: 'custom' }]}
      />
      {customMode && (
        <DatePicker.RangePicker
          size="middle"
          value={value.value === 'custom' && value.from && value.to ? [dayjs(value.from), dayjs(value.to)] : null}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              onChange({
                value: 'custom',
                from: dates[0].startOf('day').toISOString(),
                to: dates[1].endOf('day').toISOString(),
              })
            }
          }}
        />
      )}
    </div>
  )
}
