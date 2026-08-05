import { useCallback, useEffect, useState } from 'react'
import { reportService } from '../services/reportService'
import type { ReportDashboard, ReportRangeState, ReportSummary } from '../types/report'

export function useReportSummary() {
  const [range, setRange] = useState<ReportRangeState>({ value: '30d' })
  const [data, setData] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    reportService
      .getSummary(range)
      .then((res) => {
        if (active) setData(res.data)
      })
      .catch(() => {
        if (active) setError('Không thể tải dữ liệu tổng quan')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [range.value, range.from, range.to])

  return { range, setRange, data, loading, error }
}

export function useReportDashboard(module: string) {
  const [range, setRange] = useState<ReportRangeState>({ value: '30d' })
  const [data, setData] = useState<ReportDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    reportService
      .getDashboard(module, range)
      .then((res) => {
        if (active) setData(res.data)
      })
      .catch(() => {
        if (active) setError('Không thể tải dữ liệu dashboard')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [module, range.value, range.from, range.to, refreshKey])

  return { range, setRange, data, loading, error, refresh }
}
