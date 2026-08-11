import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { getFinance, getMembers, getPt, getBooking, getShop, getSystem, getTransactions, getSummary, resolveRange } from './reportService.js'

const fmtMoney = (n) => `${Number(n || 0).toLocaleString('vi-VN')} đ`

const MODULE_META = {
  finance: { label: 'Tài chính' },
  members: { label: 'Hội viên' },
  pt: { label: 'Huấn luyện viên' },
  booking: { label: 'Booking & Lớp học' },
  shop: { label: 'Shop' },
  system: { label: 'Hệ thống' },
}

const moduleLoaders = {
  finance: getFinance,
  members: getMembers,
  pt: getPt,
  booking: getBooking,
  shop: getShop,
  system: getSystem,
}

const ROW_LIMIT = 2000

const getModuleData = async (module, { range = '30d', from, to } = {}) => {
  const loader = moduleLoaders[module]
  if (!loader) throw new Error('Module không hợp lệ')
  return loader({ range, from, to })
}

const fetchTransactions = async (range) => {
  const data = await getTransactions({ range, page: 1, pageSize: ROW_LIMIT })
  return data.rows
}

const TRANSACTION_COLUMNS = [
  { header: 'Mã giao dịch', key: 'code', width: 22 },
  { header: 'Hội viên', key: 'memberName', width: 20 },
  { header: 'Email', key: 'memberEmail', width: 26 },
  { header: 'SĐT', key: 'memberPhone', width: 15 },
  { header: 'Gói / Shop', key: 'plan', width: 22 },
  { header: 'Loại giao dịch', key: 'typeLabel', width: 16 },
  { header: 'Thanh toán', key: 'paymentMethod', width: 14 },
  { header: 'Giá', key: 'amount', width: 16 },
  { header: 'Giảm giá', key: 'discount', width: 14 },
  { header: 'Thuế', key: 'tax', width: 12 },
  { header: 'Hoàn tiền', key: 'refund', width: 14 },
  { header: 'Trạng thái', key: 'statusLabel', width: 18 },
  { header: 'Nhân viên xử lý', key: 'staff', width: 18 },
  { header: 'PT liên quan', key: 'ptName', width: 18 },
  { header: 'Thời gian', key: 'timeLabel', width: 20 },
  { header: 'Ghi chú', key: 'note', width: 28 },
]

const styleHeaderRow = (row, fill) => {
  row.height = 22
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill || 'FFB6462F' } }
    cell.alignment = { vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }
  })
}

const addTitleRow = (ws, text) => {
  ws.addRow([text]).font = { bold: true, size: 14, color: { argb: 'FF1F2937' } }
  ws.addRow([])
}

const kpiToRow = (kpi) => {
  let value = kpi.value
  if (kpi.format === 'money') value = fmtMoney(kpi.value)
  else if (kpi.format === 'percent') value = `${kpi.value}%`
  else if (kpi.format === 'rating') value = `${kpi.value}/5`
  else value = Number(kpi.value || 0).toLocaleString('vi-VN')
  const delta = kpi.delta === null || kpi.delta === undefined ? '' : `${kpi.delta > 0 ? '+' : ''}${kpi.delta}%`
  return { label: kpi.label, value, delta }
}

export const buildXlsx = async ({ module = 'finance', range = '30d', from, to }) => {
  const data = await getModuleData(module, { range, from, to })
  const txRows = await fetchTransactions({ range, from, to })
  const r = data.range
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  workbook.creator = 'GymPro'

  const periodLabel = `${r.from.toLocaleDateString('vi-VN')} → ${r.to.toLocaleDateString('vi-VN')}`

  // Sheet 1: Tổng quan
  const overview = workbook.addWorksheet('Tổng quan')
  addTitleRow(overview, `Báo cáo ${MODULE_META[module]?.label || module} - GymPro`)
  overview.addRow([`Khoảng thời gian: ${periodLabel}`]).font = { color: { argb: 'FF6B7280' } }
  overview.addRow([`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`]).font = { color: { argb: 'FF6B7280' } }
  overview.addRow([])
  overview.addRow(['Chỉ số', 'Giá trị', 'So với kỳ trước'])
  styleHeaderRow(overview.getRow(overview.lastRow.number))
  data.kpis.forEach((kpi) => {
    const row = kpiToRow(kpi)
    overview.addRow([row.label, row.value, row.delta])
  })
  overview.addRow([])
  overview.addRow(['Tổng quan module'])
  overview.addRow([`Module ${MODULE_META[module]?.label || module}: ${data.kpis.length} chỉ số chính trong kỳ.`]).font = { color: { argb: 'FF6B7280' } }
  overview.columns.forEach((col, i) => { col.width = i === 0 ? 32 : 22 })

  // Sheet 2: Tops
  const tops = workbook.addWorksheet('Top danh sách')
  addTitleRow(tops, 'Bảng xếp hạng nổi bật')
  Object.entries(data.tops || {}).forEach(([key, top]) => {
    tops.addRow([top.title]).font = { bold: true, size: 12 }
    tops.addRow(['Hạng', 'Đối tượng', 'Giá trị', 'Chi tiết'])
    styleHeaderRow(tops.getRow(tops.lastRow.number), 'FF374151')
    top.items.forEach((item, i) => {
      const value = typeof item.value === 'number' ? (item.value >= 1000 ? fmtMoney(item.value) : item.value.toLocaleString('vi-VN')) : item.value
      tops.addRow([i + 1, item.label, value, item.sub || ''])
    })
    tops.addRow([])
  })
  tops.columns.forEach((col, i) => { col.width = [8, 30, 22, 26][i] || 20 })

  // Sheet 3: Biểu đồ dữ liệu
  const charts = workbook.addWorksheet('Dữ liệu biểu đồ')
  addTitleRow(charts, 'Dữ liệu chi tiết biểu đồ')
  Object.entries(data.charts || {}).forEach(([key, chart]) => {
    charts.addRow([chart.title]).font = { bold: true, size: 12 }
    const head = ['Nhãn', ...chart.series.map((s) => s.name)]
    charts.addRow(head)
    styleHeaderRow(charts.getRow(charts.lastRow.number), 'FF7C3AED')
    const n = Math.max(...chart.series.map((s) => s.data.length))
    for (let i = 0; i < n; i++) {
      charts.addRow([chart.labels[i] || '', ...chart.series.map((s) => s.data[i] || 0)])
    }
    charts.addRow([])
  })
  charts.columns.forEach((col) => { col.width = 28 })

  // Sheet 4: Chi tiết giao dịch
  const detail = workbook.addWorksheet('Chi tiết giao dịch')
  addTitleRow(detail, 'Chi tiết giao dịch')
  detail.columns = TRANSACTION_COLUMNS
  const statusMap = (s) => {
    const map = { completed: 'Hoàn tất', pending: 'Chờ xử lý', confirmed: 'Xác nhận', cancelled: 'Đã hủy', failed: 'Thất bại' }
    return map[s] || s || ''
  }
  const headerRow = detail.addRow(TRANSACTION_COLUMNS.map((c) => c.header))
  styleHeaderRow(headerRow, 'FFB6462F')
  txRows.forEach((t) => {
    detail.addRow([
      t.code,
      t.memberName,
      t.memberEmail,
      t.memberPhone,
      t.plan,
      t.typeLabel,
      t.paymentMethod,
      t.amount,
      t.discount,
      t.tax || 0,
      t.refund,
      statusMap(t.status),
      t.staff,
      t.ptName,
      t.time ? new Date(t.time).toLocaleString('vi-VN') : '',
      t.note,
    ])
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}

export const buildPdf = async ({ module = 'finance', range = '30d', from, to, actorName = 'Admin' }) => {
  const data = await getModuleData(module, { range, from, to })
  const txRows = (await fetchTransactions({ range, from, to })).slice(0, 300)
  const r = data.range
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve) => doc.on('end', resolve))

  const periodLabel = `${r.from.toLocaleDateString('vi-VN')} → ${r.to.toLocaleDateString('vi-VN')}`

  // Header on each page
  const header = () => {
    const y = 24
    doc.rect(0, 0, doc.page.width, 70).fill('#1f2937')
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('GymPro', 48, 22)
    doc.fontSize(9).font('Helvetica').text('Trung tâm thống kê - Báo cáo doanh nghiệp', 48, 44)
    doc.text(`${MODULE_META[module]?.label || module}`, doc.page.width - 48, 22, { align: 'right', width: 200 })
  }

  // Footer with page number
  const footer = () => {
    const bottom = doc.page.height - 36
    doc.fontSize(8).fillColor('#6b7280')
    doc.text(`GymPro © ${new Date().getFullYear()}  •  Xuất bởi ${actorName}  •  ${new Date().toLocaleString('vi-VN')}`, 48, bottom, { width: doc.page.width - 96, align: 'left' })
    doc.text(`Trang ${doc.page.number}`, doc.page.width - 48, bottom, { align: 'right' })
  }

  header()
  doc.moveDown(2)

  doc.fillColor('#111827').fontSize(20).font('Helvetica-Bold').text(`Báo cáo ${MODULE_META[module]?.label || module}`)
  doc.moveDown(0.5)
  doc.fontSize(11).font('Helvetica').fillColor('#374151')
  doc.text(`Khoảng thời gian: ${periodLabel}`)
  doc.text(`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`)
  doc.text(`Người xuất: ${actorName}`)
  doc.moveDown(1)

  // Overview
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('1. Tổng quan')
  doc.moveDown(0.4)
  data.kpis.forEach((kpi) => {
    const row = kpiToRow(kpi)
    doc.fontSize(10).font('Helvetica').fillColor('#374151').text(`• ${row.label}: `, { continued: true })
    doc.font('Helvetica-Bold').fillColor('#111827').text(`${row.value}${row.delta ? `   (${row.delta})` : ''}`)
  })
  doc.moveDown(1)

  // Charts summary (top chart)
  const firstChart = Object.values(data.charts || {})[0]
  if (firstChart) {
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('2. Biểu đồ chính')
    doc.moveDown(0.4)
    doc.fontSize(10).font('Helvetica').fillColor('#374151').text(`${firstChart.title}: `)
    firstChart.series.forEach((s) => {
      const total = s.data.reduce((a, b) => a + (b || 0), 0)
      doc.fontSize(9).fillColor('#6b7280').text(`   ${s.name}: tổng ${s.data.length > 0 && total >= 1000 ? fmtMoney(total) : total.toLocaleString('vi-VN')}`)
    })
    doc.moveDown(0.6)
  }

  // Tops
  const topEntries = Object.entries(data.tops || {})
  if (topEntries.length) {
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('3. Bảng xếp hạng')
    doc.moveDown(0.4)
    topEntries.slice(0, 4).forEach(([key, top]) => {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1f2937').text(top.title)
      top.items.slice(0, 5).forEach((item, i) => {
        doc.fontSize(9).font('Helvetica').fillColor('#374151').text(`   ${i + 1}. ${item.label} — ${typeof item.value === 'number' ? (item.value >= 1000 ? fmtMoney(item.value) : item.value.toLocaleString('vi-VN')) : item.value}${item.sub ? ` (${item.sub})` : ''}`)
      })
      doc.moveDown(0.4)
    })
  }

  // Transaction table
  if (txRows.length) {
    doc.addPage()
    header()
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('4. Chi tiết giao dịch')
    doc.moveDown(0.4)
    const cols = [
      { label: 'Mã', w: 64 },
      { label: 'Hội viên', w: 90 },
      { label: 'Gói/Shop', w: 80 },
      { label: 'Loại', w: 60 },
      { label: 'Số tiền', w: 70 },
      { label: 'Trạng thái', w: 70 },
      { label: 'Thời gian', w: 80 },
    ]
    const drawTableHead = () => {
      const startY = doc.y
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
      let x = 48
      doc.rect(48, startY, 500, 16).fill('#374151')
      cols.forEach((c) => {
        doc.text(c.label, x + 2, startY + 4, { width: c.w - 4 })
        x += c.w
      })
      doc.y = startY + 16
    }
    const drawTableRow = (t, i) => {
      if (doc.y > doc.page.height - 80) {
        doc.addPage()
        header()
        drawTableHead()
      }
      const y = doc.y
      if (i % 2 === 0) doc.rect(48, y, 500, 16).fill('#f3f4f6')
      doc.font('Helvetica').fontSize(8).fillColor('#111827')
      const cells = [t.code?.substring(0, 12), t.memberName, t.plan, t.typeLabel, fmtMoney(t.amount), t.status, t.time ? new Date(t.time).toLocaleString('vi-VN').slice(0, 12) : '']
      let x = 48
      cells.forEach((cell, idx) => {
        doc.text(String(cell || ''), x + 2, y + 3, { width: cols[idx].w - 4 })
        x += cols[idx].w
      })
      doc.y = y + 16
    }
    drawTableHead()
    txRows.slice(0, 150).forEach(drawTableRow)
  }

  // Conclusion
  doc.addPage()
  header()
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('5. Kết luận')
  doc.moveDown(0.5)
  doc.fontSize(10).font('Helvetica').fillColor('#374151')
  const kpi0 = data.kpis[0]
  const totalValue = kpi0?.value || 0
  doc.text(`• ${MODULE_META[module]?.label || module}: ${kpi0?.label || 'chỉ số chính'} đạt ${fmtMoney(totalValue)} trong kỳ ${periodLabel}.`)
  doc.moveDown(0.3)
  if (kpi0?.delta !== null && kpi0?.delta !== undefined) {
    doc.text(`• Mức tăng trưởng ${kpi0.delta > 0 ? 'tăng' : 'giảm'} ${Math.abs(kpi0.delta)}% so với kỳ trước.`)
  }
  doc.moveDown(0.3)
  doc.text('• Dữ liệu được tổng hợp từ hệ thống GymPro tại thời điểm xuất báo cáo.')

  const totalPages = doc.bufferedPageRange().count
  for (let i = 1; i <= totalPages; i++) {
    doc.switchToPage(i - 1)
    footer()
  }
  doc.end()
  await done
  return Buffer.concat(chunks)
}
