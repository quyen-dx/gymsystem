import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Image, Input, InputNumber, message, Select, Upload } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getMyProducts, uploadProductImage } from '../../../services/productService'

import 'quill/dist/quill.snow.css'
import ReactQuill from 'react-quill-new'

interface WeightVariant {
  label: string
  priceDelta: number
  stock: number
}

interface ProductFormValues {
  name: string
  description: string
  descriptionHtml: string
  category: string
  price: number
  stock: number
  image: string
  images: string[]
  weights: string[]
  weightVariants: WeightVariant[]
}

interface SellerProductFormProps {
  initialValues?: Partial<{
    name: string
    descriptionHtml: string
    category: string
    price: number
    stock: number
    image: string
    images: string[]
    weightVariants: WeightVariant[]
  }>
  onFinish: (values: ProductFormValues) => Promise<void>
  submitLabel: string
  pageTitle: string
  pageDescription: string
}

export default function SellerProductForm({
  initialValues,
  onFinish,
  submitLabel,
  pageTitle,
  pageDescription,
}: SellerProductFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const quillRef = useRef<ReactQuill>(null)
  const [loading, setLoading] = useState(false)
  const [existingCategories, setExistingCategories] = useState<string[]>([])

  const [mainImageUrl, setMainImageUrl] = useState('')
  const [mainImageUploading, setMainImageUploading] = useState(false)
  const [mainImageError, setMainImageError] = useState(false)

  const [galleryItems, setGalleryItems] = useState<{ url: string; preview: string }[]>([])
  const [galleryUploadingIdx, setGalleryUploadingIdx] = useState<number | null>(null)

  const [descriptionHtml, setDescriptionHtml] = useState('')
  const [descriptionError, setDescriptionError] = useState(false)
  const [descriptionErrorText, setDescriptionErrorText] = useState('')
  const [isNormalizingDescription, setIsNormalizingDescription] = useState(false)
  const [categoryDropdownValue, setCategoryDropdownValue] = useState<string | undefined>()

  useEffect(() => {
    getMyProducts().then(res => {
      const products = res.data.products || []
      const cats = Array.from(new Set(products.map((p: any) => p.category).filter(Boolean)))
      setExistingCategories(cats as string[])
    }).catch(() => { })
  }, [])

  useEffect(() => {
    if (!initialValues) return
    form.setFieldsValue({
      name: initialValues.name || '',
      category: initialValues.category || '',
      weightVariants: initialValues.weightVariants && initialValues.weightVariants.length > 0
        ? initialValues.weightVariants
        : [{ label: '', priceDelta: 0, stock: 0 }],
    })
    if (initialValues.category) setCategoryDropdownValue(initialValues.category)
    setMainImageUrl(initialValues.image || '')
    setGalleryItems(
      (initialValues.images || []).map(url => ({ url, preview: url })),
    )

    setDescriptionHtml(initialValues.descriptionHtml || '')
  }, [initialValues])

  useEffect(() => {
    let cleanup: (() => void) | null = null

    const setup = () => {
      const editor = quillRef.current?.getEditor()
      if (!editor) return false

      const handlePaste = (e: ClipboardEvent) => {
        const files = e.clipboardData?.files
        if (files && files.length > 0) {
          const imageFile = Array.from(files).find(f => f.type.startsWith('image/'))
          if (imageFile) {
            e.preventDefault()
            e.stopPropagation()
            handlePastedImageFile(imageFile)
            return
          }
        }

        const text = e.clipboardData?.getData('text/plain')
        if (!text) return

        const imgUrlRegex = /https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s]*)?/gi
        const urls = text.match(imgUrlRegex)
        if (!urls) return

        e.preventDefault()
        e.stopPropagation()

        const range = editor.getSelection(true)
        let offset = range.index

        const parts = text.split(imgUrlRegex)

        parts.forEach((part, i) => {
          if (part) {
            editor.insertText(offset, part)
            offset += part.length
          }
          if (urls[i]) {
            editor.insertEmbed(offset, 'image', urls[i])
            offset += 1
          }
        })

        editor.setSelection(offset)
      }

      const handlePastedImageFile = async (file: File) => {
        try {
          const url = await uploadFile(file)
          const quill = quillRef.current?.getEditor()
          if (!quill) return
          const range = quill.getSelection(true)
          quill.insertEmbed(range.index, 'image', url)
          quill.setSelection(range.index + 1)
        } catch {
          message.error('Không thể dán ảnh trực tiếp. Vui lòng sao chép địa chỉ hình ảnh hoặc upload ảnh.')
        }
      }

      const root = editor.root
      root.addEventListener('paste', handlePaste, true)
      cleanup = () => root.removeEventListener('paste', handlePaste, true)
      return true
    }

    if (!setup()) {
      const timer = setTimeout(setup, 100)
      return () => {
        clearTimeout(timer)
        cleanup?.()
      }
    }

    return () => cleanup?.()
  }, [])

  const uploadFile = async (file: File): Promise<string> => {
    const res = await uploadProductImage(file)
    return res.data.url
  }

  const base64ToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
    const bstr = atob(arr[1])
    const n = bstr.length
    const u8arr = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i)
    }
    return new File([u8arr], filename, { type: mime })
  }

  const isBase64ImageSrc = (src = '') => /^data:image\/[a-z0-9.+-]+;base64,/i.test(src.trim())
  const isValidDescriptionImageSrc = (src = '') => {
    const normalized = src.trim()
    return Boolean(normalized) &&
      !isBase64ImageSrc(normalized) &&
      !/^blob:/i.test(normalized) &&
      (/^https?:\/\//i.test(normalized) || /^\/(?!\/)/.test(normalized) || /^\/\//.test(normalized))
  }

  const getDescriptionContent = (html: string) => {
    const tempEl = document.createElement('div')
    tempEl.innerHTML = html || ''
    const plainText = (tempEl.textContent || tempEl.innerText || '')
      .replace(/\u200B/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const images = Array.from(tempEl.querySelectorAll('img'))
    const base64Images = images
      .map(img => img.getAttribute('src') || '')
      .filter(isBase64ImageSrc)
    const validImageUrls = images
      .map(img => img.getAttribute('src') || '')
      .filter(isValidDescriptionImageSrc)

    return {
      plainText,
      base64Images,
      validImageUrls,
      hasValidContent: Boolean(plainText || validImageUrls.length),
      hasAnyContent: Boolean(plainText || images.length),
    }
  }

  const normalizeDescriptionHtml = async (html: string): Promise<{ html: string; uploadedCount: number }> => {
    const tempEl = document.createElement('div')
    tempEl.innerHTML = html || ''
    const images = Array.from(tempEl.querySelectorAll('img'))
    const base64Images = images.filter(img => isBase64ImageSrc(img.getAttribute('src') || ''))
    if (base64Images.length === 0) return { html, uploadedCount: 0 }

    const cache = new Map<string, string>()
    for (let i = 0; i < base64Images.length; i++) {
      const img = base64Images[i]
      const base64 = img.getAttribute('src') || ''
      if (cache.has(base64)) {
        img.setAttribute('src', cache.get(base64)!)
        continue
      }
      try {
        const file = base64ToFile(base64, `description-image-${i}.png`)
        const url = await uploadFile(file)
        cache.set(base64, url)
        img.setAttribute('src', url)
      } catch {
        throw new Error('Upload ảnh mô tả thất bại')
      }
    }
    return { html: tempEl.innerHTML, uploadedCount: base64Images.length }
  }

  const stripBase64DescriptionImages = (html: string) => {
    const tempEl = document.createElement('div')
    tempEl.innerHTML = html || ''
    const images = Array.from(tempEl.querySelectorAll('img'))
    let removedCount = 0

    images.forEach(img => {
      if (isBase64ImageSrc(img.getAttribute('src') || '')) {
        img.remove()
        removedCount += 1
      }
    })

    return { html: tempEl.innerHTML, removedCount }
  }

  const addDescriptionImageClass = (html: string) => {
    const tempEl = document.createElement('div')
    tempEl.innerHTML = html || ''
    tempEl.querySelectorAll('img').forEach(img => {
      img.classList.add('product-description-image')
    })
    return tempEl.innerHTML
  }

  const removeBase64DescriptionImages = () => {
    const stripped = stripBase64DescriptionImages(descriptionHtml)

    setDescriptionHtml(stripped.html)
    setDescriptionError(false)
    setDescriptionErrorText('')
    if (stripped.removedCount > 0) {
      message.success(`Đã xóa ${stripped.removedCount} ảnh dán trực tiếp khỏi mô tả`)
    }
  }

  const handleMainImageFile = async (file: File) => {
    setMainImageUploading(true)
    setMainImageUrl(URL.createObjectURL(file))
    try {
      const url = await uploadFile(file)
      setMainImageUrl(url)
    } catch {
      message.error('Upload ảnh chính thất bại')
      setMainImageUrl('')
    } finally {
      setMainImageUploading(false)
    }
  }

  const handleGalleryFile = async (file: File, index: number) => {
    setGalleryUploadingIdx(index)
    setGalleryItems(prev => prev.map((item, i) => i === index ? { ...item, preview: URL.createObjectURL(file) } : item))
    try {
      const url = await uploadFile(file)
      setGalleryItems(prev => prev.map((item, i) => i === index ? { url, preview: url } : item))
    } catch {
      message.error('Upload ảnh phụ thất bại')
      setGalleryItems(prev => prev.filter((_, i) => i !== index))
    } finally {
      setGalleryUploadingIdx(null)
    }
  }

  const addGalleryItem = () => {
    setGalleryItems(prev => [...prev, { url: '', preview: '' }])
  }

  const updateGalleryUrl = (index: number, url: string) => {
    setGalleryItems(prev => prev.map((item, i) => i === index ? { url, preview: url } : item))
  }

  const removeGalleryItem = (index: number) => {
    setGalleryItems(prev => prev.filter((_, i) => i !== index))
  }

  const quillImageHandler = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        const url = window.prompt('Nhập URL ảnh:')
        if (url) {
          const quill = quillRef.current?.getEditor()
          const range = quill?.getSelection()
          if (range) {
            quill?.insertEmbed(range.index, 'image', url)
            quill?.setSelection(range.index + 1)
          }
        }
        return
      }
      try {
        const url = await uploadFile(file)
        const quill = quillRef.current?.getEditor()
        const range = quill?.getSelection()
        if (range) {
          quill?.insertEmbed(range.index, 'image', url)
          quill?.setSelection(range.index + 1)
        }
      } catch {
        message.error('Upload ảnh thất bại')
      }
    }
    input.click()
  }

  const quillModules = {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image'],
        ['clean'],
      ],
      handlers: {
        image: quillImageHandler,
      },
    },
  }

  const quillFormats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'ordered',
    'link', 'image', 'clean',
  ]

  const handleSubmit = async (values: any) => {
    try {
      await form.validateFields(['name', 'category', 'weightVariants'])
    } catch {
      return
    }

    if (!mainImageUrl?.trim()) {
      setMainImageError(true)
      message.error('Vui lòng thêm ảnh chính')
      return
    }

    const initialDescriptionContent = getDescriptionContent(descriptionHtml)
    if (!initialDescriptionContent.hasAnyContent) {
      setDescriptionError(true)
      setDescriptionErrorText('Vui lòng nhập mô tả chi tiết')
      message.error('Vui lòng nhập mô tả chi tiết')
      return
    }

    if (/^data:image\/[a-z]+;base64/i.test(mainImageUrl)) {
      setMainImageError(true)
      message.error('Ảnh chính quá lớn, vui lòng upload ảnh hoặc dùng URL ảnh')
      return
    }

    const invalidGallery = galleryItems.find(item =>
      /^data:image\/[a-z]+;base64/i.test(item.url) ||
      /^blob:/i.test(item.url)
    )
    if (invalidGallery) {
      message.error('Ảnh phụ chứa dữ liệu không hợp lệ, vui lòng upload ảnh hoặc dùng URL ảnh')
      return
    }

    setLoading(true)
    try {
      setIsNormalizingDescription(true)
      let htmlForSubmit = descriptionHtml
      if (initialDescriptionContent.base64Images.length > 0) {
        try {
          const normalizedDescription = await normalizeDescriptionHtml(descriptionHtml)
          htmlForSubmit = normalizedDescription.html
          setDescriptionHtml(normalizedDescription.html)
          if (normalizedDescription.uploadedCount > 0) {
            message.success(`Đã upload ${normalizedDescription.uploadedCount} ảnh dán trực tiếp trong mô tả`)
          }
        } catch {
          const strippedDescription = stripBase64DescriptionImages(descriptionHtml)
          const strippedContent = getDescriptionContent(strippedDescription.html)

          if (strippedContent.hasValidContent) {
            htmlForSubmit = strippedDescription.html
            setDescriptionHtml(strippedDescription.html)
            message.warning(`Không thể upload ảnh dán trực tiếp, hệ thống đã xóa ${strippedDescription.removedCount} ảnh đó và giữ lại text/ảnh URL hợp lệ.`)
          } else {
            setDescriptionError(true)
            setDescriptionErrorText('Không thể upload ảnh dán trực tiếp. Bấm "Xóa ảnh dán trực tiếp" rồi thêm text hoặc ảnh URL hợp lệ.')
            message.error('Không thể upload ảnh dán trực tiếp. Vui lòng bấm "Xóa ảnh dán trực tiếp" dưới mô tả.')
            return
          }
        }
      }

      const submitDescriptionContent = getDescriptionContent(htmlForSubmit)
      if (!submitDescriptionContent.hasValidContent) {
        setDescriptionError(true)
        setDescriptionErrorText('Vui lòng nhập mô tả chi tiết bằng text hoặc ảnh URL hợp lệ')
        message.error('Vui lòng nhập mô tả chi tiết')
        return
      }

      const parsedWeightVariants = (values.weightVariants || [])
        .map((item: any) => ({
          label: String(item?.label || '').trim(),
          priceDelta: Number(item?.priceDelta || 0),
          stock: Number(item?.stock || 0),
        }))
        .filter((item: any) => item.label)

      if (parsedWeightVariants.length === 0) {
        message.error('Vui lòng thêm ít nhất 1 biến thể')
        setLoading(false)
        return
      }

      const invalidVariant = parsedWeightVariants.find((v: any) => !v.priceDelta || v.priceDelta <= 0 || v.stock < 0)
      if (invalidVariant) {
        message.error('Giá biến thể phải lớn hơn 0 và tồn kho không âm')
        setLoading(false)
        return
      }

      const validatedVariants = parsedWeightVariants.map((item: any) => ({
        ...item,
        priceDelta: Number.isFinite(item.priceDelta) && item.priceDelta > 0 ? item.priceDelta : 0,
        stock: Number.isFinite(item.stock) && item.stock >= 0 ? Math.floor(item.stock) : 0,
      }))

      const processedHtml = addDescriptionImageClass(htmlForSubmit)

      const payload: ProductFormValues = {
        name: values.name.trim(),
        description: submitDescriptionContent.plainText,
        descriptionHtml: processedHtml,
        category: values.category?.trim() || 'Khác',
        price: validatedVariants[0].priceDelta,
        stock: validatedVariants.reduce((sum: number, item: any) => sum + item.stock, 0),
        image: mainImageUrl,
        images: galleryItems.map(item => item.url).filter(Boolean),
        weights: validatedVariants.map((item: any) => item.label),
        weightVariants: validatedVariants,
      }

      await onFinish(payload)
    } catch (err: any) {
      message.error(err.response?.data?.message || t('seller_products.action_failed'))
    } finally {
      setIsNormalizingDescription(false)
      setLoading(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 24,
    border: '1px solid var(--gs-border)',
    background: 'var(--gs-card)',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 20,
    color: 'var(--gs-text)',
  }

  const previewBoxStyle: React.CSSProperties = {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid var(--gs-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--gs-elevated)',
    position: 'relative',
    flexShrink: 0,
  }

  const base64DescriptionImageCount = getDescriptionContent(descriptionHtml).base64Images.length

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/seller/products')}
          style={{ color: 'var(--gs-text)', fontSize: 15 }}
        >
          ← Quay lại sản phẩm
        </Button>
      </div>

      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] px-8 py-6 max-[640px]:px-5 max-[640px]:py-5" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent, #b6462f) 14%, transparent), transparent)' }}>
        <h1 className="text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">
          {pageTitle}
        </h1>
        <p className="mt-1 text-sm text-[var(--gs-text-muted)]">{pageDescription}</p>
      </div>

      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <div className="grid gap-6">

          {/* Section 1 */}
          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>1. Thông tin cơ bản</h2>
            <Form.Item
              label="Tên sản phẩm"
              name="name"
              rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}
            >
              <Input placeholder="VD: Găng tay tập gym" size="large" />
            </Form.Item>
          </div>

          {/* Section 2 */}
          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>2. Ảnh sản phẩm</h2>

            <div className="mb-5">
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--gs-text)' }}>
                Ảnh chính
              </label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={previewBoxStyle}>
                  {mainImageUrl ? (
                    <>
                      <Image
                        src={mainImageUrl}
                        width={100}
                        height={100}
                        style={{ objectFit: 'cover' }}
                        fallback="https://placehold.co/100x100"
                        preview={{ mask: null }}
                      />
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => { setMainImageUrl(''); setMainImageUploading(false) }}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', borderRadius: 8, color: '#fff', border: 'none' }}
                      />
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--gs-text-muted)', textAlign: 'center', padding: 4 }}>
                      Chưa có ảnh
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Input
                    placeholder="Nhập URL ảnh chính..."
                    value={mainImageUrl}
                    onChange={e => { setMainImageUrl(e.target.value); setMainImageError(false) }}
                    status={mainImageError ? 'error' : undefined}
                  />
                  {mainImageError && (
                    <span style={{ color: '#ff4d4f', fontSize: 13, lineHeight: '20px' }}>Vui lòng thêm ảnh chính</span>
                  )}
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => { handleMainImageFile(file); return false }}
                  >
                    <Button icon={<PlusOutlined />} loading={mainImageUploading}>
                      Chọn ảnh từ máy tính
                    </Button>
                  </Upload>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--gs-text)' }}>
                Ảnh phụ
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {galleryItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={previewBoxStyle}>
                      {item.preview ? (
                        <Image
                          src={item.preview}
                          width={100}
                          height={100}
                          style={{ objectFit: 'cover' }}
                          fallback="https://placehold.co/100x100"
                          preview={{ mask: null }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>Chưa có ảnh</span>
                      )}
                    </div>
                    <Input
                      placeholder="Nhập URL ảnh..."
                      value={item.url}
                      onChange={e => updateGalleryUrl(idx, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Upload
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={(file) => { handleGalleryFile(file, idx); return false }}
                    >
                      <Button loading={galleryUploadingIdx === idx}>
                        Chọn ảnh từ máy tính
                      </Button>
                    </Upload>
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removeGalleryItem(idx)}
                    />
                  </div>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={addGalleryItem} style={{ alignSelf: 'flex-start' }}>
                  Thêm ảnh phụ
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>3. Mô tả chi tiết</h2>
            <div style={{ background: 'var(--gs-input-bg, rgba(255,255,255,0.05))', borderRadius: 12 }}>
              <ReactQuill
                ref={quillRef}
                value={descriptionHtml}
                onChange={(val) => { setDescriptionHtml(val); setDescriptionError(false); setDescriptionErrorText('') }}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Viết mô tả sản phẩm..."
                style={{ minHeight: 350 }}
                theme="snow"
              />
            </div>
            <style>{`
              .quill {
                border-radius: 12px;
                overflow: hidden;
              }
              .ql-toolbar {
                border-color: var(--gs-border) !important;
                border-radius: 12px 12px 0 0;
                background: var(--gs-elevated);
              }
              .ql-container {
                border-color: var(--gs-border) !important;
                border-radius: 0 0 12px 12px;
                min-height: 300px;
                font-size: 15px;
                color: var(--gs-text);
              }
              .ql-editor {
                min-height: 300px;
                color: var(--gs-text);
                overflow-wrap: anywhere;
                word-break: break-word;
                white-space: pre-wrap;
              }
              .ql-editor.ql-blank::before {
                color: var(--gs-text-muted) !important;
                font-style: normal;
              }
              .ql-snow .ql-stroke {
                stroke: var(--gs-text);
              }
              .ql-snow .ql-fill {
                fill: var(--gs-text);
              }
              .ql-snow .ql-picker-label {
                color: var(--gs-text);
              }
              .ql-snow .ql-picker-options {
                background: var(--gs-elevated, #1a1a1a);
                border-color: var(--gs-border);
              }
              .ql-snow .ql-picker.ql-expanded .ql-picker-label {
                border-color: var(--gs-border);
              }
              .ql-snow a {
                color: var(--gs-accent, #b6462f);
              }
              .ql-editor img {
                display: block;
                max-width: 280px;
                max-height: 220px;
                width: auto;
                height: auto;
                object-fit: contain;
                margin: 12px auto;
                border-radius: 8px;
              }
              @media (max-width: 640px) {
                .ql-editor img {
                  max-width: 100%;
                  max-height: none;
                }
              }
            `}</style>
            {base64DescriptionImageCount > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message={`Mô tả có ${base64DescriptionImageCount} ảnh dán trực tiếp`}
                description="Ảnh vẫn được hiển thị để bạn kiểm tra. Khi cập nhật, hệ thống sẽ tự upload ảnh này và thay bằng URL; nếu upload lỗi, hệ thống sẽ xóa ảnh dán trực tiếp và giữ lại text/ảnh URL hợp lệ."
                action={
                  <Button size="small" danger onClick={removeBase64DescriptionImages}>
                    Xóa ảnh dán trực tiếp
                  </Button>
                }
              />
            )}
            {descriptionError && (
              <p style={{ color: '#ff4d4f', fontSize: 13, marginTop: 6 }}>
                {descriptionErrorText || 'Vui lòng nhập mô tả chi tiết'}
              </p>
            )}
          </div>

          {/* Section 4 */}
          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>4. Danh mục</h2>
            <div className="category-grid">
              <Form.Item label="Danh mục" name="category" rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}>
                <Input
                  placeholder="VD: Dụng cụ tập, Thực phẩm bổ sung..." size="large"
                  onChange={() => setCategoryDropdownValue(undefined)}
                />
              </Form.Item>
              <Form.Item label="Chọn danh mục có sẵn">
                <Select
                  allowClear
                  placeholder="Chọn..."
                  value={categoryDropdownValue}
                  options={existingCategories.map(c => ({ label: c, value: c }))}
                  onChange={(value) => {
                    form.setFieldValue('category', value || '')
                    setCategoryDropdownValue(value || undefined)
                  }}
                  size="large"
                />
              </Form.Item>
            </div>
            <style>{`
              .category-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
              }
              @media (max-width: 640px) {
                .category-grid {
                  grid-template-columns: 1fr;
                }
              }
            `}</style>
          </div>

          {/* Section 5 */}
          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>5. Tồn kho / Biến thể</h2>

            <div className="variants-section">
              <label style={{ fontWeight: 500, color: 'var(--gs-text)', display: 'block', marginBottom: 4 }}>
                Biến thể (theo khối lượng / kích thước)
              </label>
              <div className="variants-header">
                <span>Biến thể / trọng lượng</span>
                <span>Giá (VNĐ)</span>
                <span>Tồn kho</span>
                <span />
              </div>
              <Form.List name="weightVariants">
                {(fields, { add, remove }) => (
                  <div className="variants-list">
                    {fields.map((field) => (
                      <div key={field.key} className="variant-row">
                        <Form.Item
                          {...field}
                          name={[field.name, 'label']}
                          className="variant-field"
                          rules={[{ required: true, message: 'Nhập tên biến thể' }]}
                        >
                          <Input placeholder="VD: 500g, 1kg, XL..." size="large" />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'priceDelta']}
                          className="variant-field"
                          rules={[
                            { required: true, message: 'Nhập giá' },
                            { type: 'number', min: 1, message: 'Giá phải > 0' },
                          ]}
                        >
                          <InputNumber
                            min={1}
                            style={{ width: '100%' }}
                            placeholder="VD: 100000"
                            size="large"
                            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(v) => Number(String(v || '').replace(/\D/g, '')) as any}
                          />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'stock']}
                          className="variant-field"
                          rules={[
                            { required: true, message: 'Nhập tồn kho' },
                            { type: 'number', min: 0, message: 'Tồn kho không hợp lệ' },
                          ]}
                        >
                          <InputNumber min={0} style={{ width: '100%' }} placeholder="VD: 50" size="large" />
                        </Form.Item>
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                          size="large"
                          className="variant-delete-btn"
                        />
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => add({ label: '', priceDelta: 0, stock: 0 })}
                      size="large"
                      className="variant-add-btn"
                    >
                      Thêm biến thể
                    </Button>
                  </div>
                )}
              </Form.List>
            </div>
            <style>{`
              .variants-section {
                margin-bottom: 8px;
              }
              .variants-header {
                display: grid;
                grid-template-columns: repeat(3, 1fr) 40px;
                gap: 8px;
                padding: 4px 0 6px 0;
              }
              .variants-header span {
                font-size: 13px;
                font-weight: 600;
                color: var(--gs-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
              .variants-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
              }
              .variant-row {
                display: grid;
                grid-template-columns: repeat(3, 1fr) 40px;
                gap: 8px;
                align-items: start;
              }
              .variant-field {
                margin-bottom: 0;
              }
              .variant-delete-btn {
                justify-self: center;
                margin-top: 4px;
              }
              .variant-add-btn {
                align-self: flex-start;
              }
              @media (max-width: 640px) {
                .variants-header {
                  display: none;
                }
                .variant-row {
                  grid-template-columns: 1fr;
                  gap: 6px;
                  padding-bottom: 16px;
                  margin-bottom: 6px;
                  border-bottom: 1px solid var(--gs-border);
                  position: relative;
                }
                .variant-delete-btn {
                  position: absolute;
                  top: 0;
                  right: 0;
                  margin-top: 0;
                }
              }
            `}</style>
          </div>



          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button size="large" onClick={() => navigate('/seller/products')}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" size="large" loading={loading} disabled={isNormalizingDescription}>
              {isNormalizingDescription ? 'Đang xử lý ảnh mô tả...' : submitLabel}
            </Button>
          </div>
        </div>
      </Form>

      <div style={{ height: 40 }} />
    </>
  )
}
