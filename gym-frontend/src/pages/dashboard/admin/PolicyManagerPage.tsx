import { Button, Form, Input, Modal, Select, Space, Switch, Table, message } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { systemExperienceService } from '../../../services/systemExperienceService'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

interface CategoryPair {
  vi: string
  en: string
}

export default function PolicyManagerPage() {
  const [items, setItems] = useState<any[]>([])
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [form] = Form.useForm()
  const [selectedCategoryVi, setSelectedCategoryVi] = useState<string | undefined>(undefined)
  const [selectedCategoryEn, setSelectedCategoryEn] = useState<string | undefined>(undefined)
  const [newCategoryVi, setNewCategoryVi] = useState('')
  const [newCategoryEn, setNewCategoryEn] = useState('')

  const load = () => {
    setLoading(true)
    systemExperienceService.getPolicies({ includeHidden: true })
      .then((res) => setItems(res.data.policies || []))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const existingCategoryPairs = useMemo(() => {
    const map = new Map<string, CategoryPair>()
    items.forEach((item) => {
      const vi = item.categoryVi || item.category
      const en = item.categoryEn || item.category
      if (!vi || !en) return
      const normalizedVi = normalizeCategory(vi)
      const normalizedEn = normalizeCategory(en)
      const key = normalizedVi.toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          vi: normalizedVi,
          en: normalizedEn,
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.vi.localeCompare(b.vi))
  }, [items])

  const findExistingPair = (vi = '', en = '') => {
    const nvi = vi ? normalizeCategory(vi).toLowerCase() : ''
    const nen = en ? normalizeCategory(en).toLowerCase() : ''
    return existingCategoryPairs.find((pair) => (
      nvi && normalizeCategory(pair.vi).toLowerCase() === nvi
    ) || (
      nen && normalizeCategory(pair.en).toLowerCase() === nen
    ))
  }

  const getCanonicalPair = (vi: string, en: string): CategoryPair => {
    const nvi = normalizeCategory(vi)
    const nen = normalizeCategory(en)
    const existing = findExistingPair(nvi, nen)
    if (existing) return existing
    return { vi: nvi, en: nen }
  }

  const resetCategoryFields = () => {
    setSelectedCategoryVi(undefined)
    setSelectedCategoryEn(undefined)
    setNewCategoryVi('')
    setNewCategoryEn('')
  }

  const openAddModal = () => {
    navigate('/admin/policies/create')
  }

  const openEditModal = (row: any) => {
    navigate(`/admin/policies/${row._id}/edit`)
  }

  const closeModal = () => {
    setOpen(false)
    setEditing(null)
    form.resetFields()
    resetCategoryFields()
  }

  const save = async () => {
    const values = await form.validateFields()

    const hasSelected = selectedCategoryVi && selectedCategoryEn
    const hasAnyNew = newCategoryVi.trim() || newCategoryEn.trim()
    const hasCompleteNew = newCategoryVi.trim() && newCategoryEn.trim()

    if (hasSelected) {
      values.categoryVi = selectedCategoryVi
      values.categoryEn = selectedCategoryEn
    } else if (hasAnyNew) {
      const existing = findExistingPair(newCategoryVi, newCategoryEn)
      if (!hasCompleteNew && !existing) {
        message.error('Vui lòng chọn hoặc nhập danh mục')
        return
      }
      const pair = getCanonicalPair(newCategoryVi, newCategoryEn)
      values.categoryVi = pair.vi
      values.categoryEn = pair.en
    } else {
      message.error('Vui lòng chọn hoặc nhập danh mục')
      return
    }

    try {
      if (editing) await systemExperienceService.updatePolicy(editing._id, values)
      else await systemExperienceService.createPolicy(values)
      message.success('Lưu thành công')
      closeModal()
      load()
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Lưu thất bại')
    }
  }

  const handleSelectVi = (value: string | undefined) => {
    if (!value) {
      setSelectedCategoryVi(undefined)
      setSelectedCategoryEn(undefined)
      return
    }
    const pair = existingCategoryPairs.find((p) => normalizeCategory(p.vi).toLowerCase() === normalizeCategory(value).toLowerCase())
    if (pair) {
      setSelectedCategoryVi(pair.vi)
      setSelectedCategoryEn(pair.en)
      setNewCategoryVi('')
      setNewCategoryEn('')
    }
  }

  const handleSelectEn = (value: string | undefined) => {
    if (!value) {
      setSelectedCategoryVi(undefined)
      setSelectedCategoryEn(undefined)
      return
    }
    const pair = existingCategoryPairs.find((p) => normalizeCategory(p.en).toLowerCase() === normalizeCategory(value).toLowerCase())
    if (pair) {
      setSelectedCategoryVi(pair.vi)
      setSelectedCategoryEn(pair.en)
      setNewCategoryVi('')
      setNewCategoryEn('')
    }
  }

  return (
    <DashboardLayout>
      <div className="grid gap-4">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Quản lý chính sách</h1><Button type="primary" onClick={openAddModal}>Thêm chính sách</Button></div>
        <Table rowKey="_id" loading={loading} dataSource={items} columns={[
          { title: 'STT', width: 70, align: 'center' as const, render: (_: any, __: any, index: number) => (page - 1) * 10 + index + 1 },
          { title: 'Tiêu đề', dataIndex: 'titleVi', render: (_: any, row: any) => row.titleVi || row.titleEn },
          { title: 'Slug', dataIndex: 'slug' },
          { title: 'Danh mục', dataIndex: 'categoryVi', render: (_: any, row: any) => row.categoryVi || row.categoryEn },
          { title: 'Trạng thái', dataIndex: 'isPublished', render: (v) => v ? 'Đã xuất bản' : 'Ẩn' },
          { title: 'Thao tác', render: (_, row: any) => <Space><Button onClick={() => openEditModal(row)}>Sửa</Button><Button danger onClick={() => {
              Modal.confirm({
                title: 'Xác nhận xóa chính sách',
                icon: <ExclamationCircleOutlined />,
                content: 'Bạn có chắc muốn xóa chính sách này không?',
                okText: 'Xóa',
                okType: 'danger',
                cancelText: 'Hủy',
                onOk: async () => {
                  await systemExperienceService.deletePolicy(row._id)
                  load()
                },
              })
            }}>Xóa</Button></Space> },
        ]} pagination={{ current: page, pageSize: 10, onChange: setPage }} />
      </div>
      <Modal width={760} title={editing ? 'Chỉnh sửa chính sách' : 'Thêm chính sách'} open={open} onOk={save} onCancel={closeModal}>
        <Form form={form} layout="vertical" initialValues={{ isPublished: true }}>
          <Form.Item name="titleVi" label="Tiêu đề (Tiếng Việt)" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="titleEn" label="Tiêu đề (Tiếng Anh)" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="slug" label="Slug"><Input /></Form.Item>
          <Form.Item name="contentVi" label="Nội dung (Tiếng Việt)" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="contentEn" label="Nội dung (Tiếng Anh)" rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item label="Danh mục">
            <div className="grid gap-3">
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">Chọn danh mục có sẵn</div>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Select placeholder="Tiếng Việt" allowClear value={selectedCategoryVi} onChange={handleSelectVi} options={existingCategoryPairs.map((p) => ({ label: p.vi, value: p.vi }))} />
                <Select placeholder="English" allowClear value={selectedCategoryEn} onChange={handleSelectEn} options={existingCategoryPairs.map((p) => ({ label: p.en, value: p.en }))} />
              </div>
              <div className="text-sm font-medium text-[var(--gs-text-soft)]">Hoặc tạo danh mục mới</div>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <Input placeholder="Tên danh mục (Tiếng Việt)" value={newCategoryVi} onChange={(e) => { setNewCategoryVi(e.target.value); if (e.target.value) { setSelectedCategoryVi(undefined); setSelectedCategoryEn(undefined) } }} />
                <Input placeholder="Tên danh mục (Tiếng Anh)" value={newCategoryEn} onChange={(e) => { setNewCategoryEn(e.target.value); if (e.target.value) { setSelectedCategoryVi(undefined); setSelectedCategoryEn(undefined) } }} />
              </div>
            </div>
          </Form.Item>
          <Form.Item name="isPublished" label="Xuất bản" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
