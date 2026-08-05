import { Button, Dropdown, message } from 'antd'
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import { reportService, downloadBlob } from '../../services/reportService'
import type { ReportModule, ReportRangeState } from '../../types/report'

interface ReportExportButtonProps {
  module: ReportModule
  range: ReportRangeState
}

export default function ReportExportButton({ module, range }: ReportExportButtonProps) {
  const handleExport = async (format: 'xlsx' | 'pdf') => {
    const hide = message.loading(format === 'xlsx' ? 'Đang xuất file Excel...' : 'Đang xuất file PDF...', 0)
    try {
      const res = await reportService.exportReport(module, range, format)
      const ext = format === 'xlsx' ? 'xlsx' : 'pdf'
      const now = new Date()
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      downloadBlob(res.data, `GymPro-${module}-${stamp}.${ext}`)
      message.success(`Xuất file ${format.toUpperCase()} thành công`)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Xuất file thất bại')
    } finally {
      hide()
    }
  }

  const items = [
    { key: 'xlsx', label: 'Excel (.xlsx)', icon: <FileExcelOutlined />, onClick: () => handleExport('xlsx') },
    { key: 'pdf', label: 'PDF (.pdf)', icon: <FilePdfOutlined />, onClick: () => handleExport('pdf') },
  ]

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Button type="primary" icon={<DownloadOutlined />} className="rounded-xl border-none bg-[var(--theme-accent)] hover:opacity-90">
        Xuất báo cáo
      </Button>
    </Dropdown>
  )
}
