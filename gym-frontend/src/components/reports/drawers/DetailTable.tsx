import { Drawer, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DetailTableProps<T extends { id: string }> {
  open: boolean
  title: ReactNode
  onClose: () => void
  columns: ColumnsType<T>
  rowKey?: string
  emptyText?: string
  fetch: (params: Record<string, any>) => Promise<{ rows: T[]; total: number }>
  buildParams: () => Record<string, any>
  filterBar?: ReactNode
  width?: string | number
}

export default function DetailTable<T extends { id: string }>({
  open,
  title,
  onClose,
  columns,
  rowKey = 'id',
  emptyText = 'Không có dữ liệu',
  fetch,
  buildParams,
  filterBar,
  width = 'min(94vw, 1100px)',
}: DetailTableProps<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)

  const paramsKey = JSON.stringify(buildParams())
  const prevKey = useRef(paramsKey)

  useEffect(() => {
    if (prevKey.current !== paramsKey) {
      prevKey.current = paramsKey
      setPage(1)
    }
  }, [paramsKey])

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    fetch({ ...buildParams(), page, pageSize })
      .then((res) => {
        if (!active) return
        setRows(res.rows)
        setTotal(res.total)
      })
      .catch(() => {
        if (active) setRows([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paramsKey, page, pageSize])

  return (
    <Drawer title={title} open={open} onClose={onClose} width={width} styles={{ body: { padding: 16, background: 'var(--gs-bg)' } }}>
      {filterBar}
      <Table
        rowKey={rowKey}
        loading={loading}
        columns={columns}
        dataSource={rows}
        size="small"
        scroll={{ x: 'max-content' }}
        locale={{ emptyText }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Tổng ${t} bản ghi`,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
      />
    </Drawer>
  )
}
