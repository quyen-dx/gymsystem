import { toolRegistry } from './toolRegistry.js'

const INTENTS = [
  'membership', 'pt', 'booking', 'checkin', 'product',
  'workout', 'faq', 'policy', 'navigation',
  'health', 'nutrition', 'account', 'report', 'general',
]

const SUBJECTS = [
  'plan', 'membership_plans', 'pt', 'trainer', 'booking', 'schedule',
  'checkin', 'progress', 'product', 'shop',
  'workout', 'health', 'nutrition', 'diet',
  'faq', 'policy', 'navigation', 'account', 'report',
  'general', 'unknown',
]

const ACTIONS = [
  'list', 'detail', 'compare', 'recommend', 'advice',
  'create', 'update', 'cancel', 'status', 'renew',
  'check', 'analyze', 'search', 'explain', 'navigate',
  'ask_general', 'clarify',
]

export const buildIntentSchema = () => {
  const registeredTools = toolRegistry.getAllToolNames()

  return {
    type: 'object',
    required: ['intent', 'confidence', 'tools'],
    properties: {
      intent: {
        type: 'string',
        enum: INTENTS,
        description: 'Danh mục chính của câu hỏi',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Độ tin cậy 0.0-1.0',
      },
      tools: {
        type: 'array',
        items: {
          type: 'string',
          enum: registeredTools.length > 0 ? registeredTools : undefined,
        },
        description: 'Danh sách tool cần gọi, lấy từ danh sách tool có sẵn',
      },
      subject: {
        type: 'string',
        enum: SUBJECTS,
        description: 'Chủ đề chi tiết (optional)',
      },
      action: {
        type: 'string',
        enum: ACTIONS,
        description: 'Hành động cần thực hiện (optional)',
      },
      entityName: {
        type: 'string',
        description: 'Tên thực thể được nhắc đến (tên PT, tên gói, tên sản phẩm)',
      },
      isFollowUp: {
        type: 'boolean',
        description: 'Câu hỏi follow-up từ ngữ cảnh trước',
      },
      needsPermissionCheck: {
        type: 'boolean',
        description: 'Cần kiểm tra quyền (dữ liệu người khác)',
      },
      reason: {
        type: 'string',
        description: 'Lý do phân tích ngắn gọn',
      },
    },
    additionalProperties: false,
    errorMessage: {
      required: {
        intent: 'Thiếu intent — phải là một trong: ' + INTENTS.join(', '),
        confidence: 'Thiếu confidence — phải là số 0.0-1.0',
        tools: 'Thiếu tools — phải là mảng các tên tool có sẵn',
      },
      properties: {
        intent: 'intent không hợp lệ. Cho phép: ' + INTENTS.join(', '),
        confidence: 'confidence phải là số từ 0 đến 1',
        tools: 'tools chứa tên tool không tồn tại trong hệ thống',
      },
      additionalProperties: 'Chỉ chấp nhận các trường trong schema. Không thêm trường lạ.',
    },
  }
}

export const validateIntentOutput = (output) => {
  const errors = []

  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['Output must be a JSON object'] }
  }

  const schema = buildIntentSchema()
  const registeredTools = new Set(toolRegistry.getAllToolNames())

  // 1. Required: intent
  if (!output.intent || typeof output.intent !== 'string') {
    errors.push('Missing or invalid "intent" — must be a string')
  } else if (!INTENTS.includes(output.intent)) {
    errors.push(`Invalid intent "${output.intent}". Allowed: ${INTENTS.join(', ')}`)
  }

  // 2. Required: confidence
  if (output.confidence === undefined || output.confidence === null) {
    errors.push('Missing "confidence" — must be a number 0.0-1.0')
  } else {
    const c = Number(output.confidence)
    if (Number.isNaN(c) || c < 0 || c > 1) {
      errors.push(`Invalid confidence ${output.confidence} — must be between 0 and 1`)
    }
  }

  // 3. Required: tools
  if (!Array.isArray(output.tools)) {
    errors.push('Missing or invalid "tools" — must be an array of tool names')
  } else if (registeredTools.size > 0) {
    const invalid = output.tools.filter(t => !registeredTools.has(t))
    if (invalid.length > 0) {
      errors.push(`Unknown tool(s): ${invalid.join(', ')}. Available: ${[...registeredTools].join(', ')}`)
    }
  }

  // 4. Optional: subject
  if (output.subject !== undefined && output.subject !== null) {
    if (!SUBJECTS.includes(output.subject)) {
      errors.push(`Invalid subject "${output.subject}". Allowed: ${SUBJECTS.join(', ')}`)
    }
  }

  // 5. Optional: action
  if (output.action !== undefined && output.action !== null) {
    if (!ACTIONS.includes(output.action)) {
      errors.push(`Invalid action "${output.action}". Allowed: ${ACTIONS.join(', ')}`)
    }
  }

  // 6. Additional properties
  const allowedKeys = new Set(['intent', 'confidence', 'tools', 'subject', 'action', 'entityName', 'isFollowUp', 'needsPermissionCheck', 'reason'])
  for (const key of Object.keys(output)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unknown field "${key}" — not allowed in schema`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export const sanitizeIntentOutput = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return {
      intent: 'general',
      confidence: 0,
      tools: [],
      subject: 'general',
      action: 'ask_general',
      entityName: '',
      isFollowUp: false,
      needsPermissionCheck: false,
      reason: 'Invalid output from classifier',
    }
  }

  const intent = INTENTS.includes(raw.intent) ? raw.intent : 'general'
  const subject = SUBJECTS.includes(raw.subject) ? raw.subject : 'general'

  const intentToSubject = {
    membership: 'plan',
    pt: 'pt',
    booking: 'booking',
    checkin: 'checkin',
    product: 'product',
    workout: 'workout',
    faq: 'faq',
    policy: 'policy',
    navigation: 'navigation',
    health: 'health',
    nutrition: 'nutrition',
    account: 'account',
    report: 'report',
    general: 'general',
  }

  return {
    intent,
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0)),
    tools: Array.isArray(raw.tools) ? raw.tools.filter(t => typeof t === 'string') : [],
    subject: raw.subject || intentToSubject[intent] || 'general',
    action: ACTIONS.includes(raw.action) ? raw.action : 'ask_general',
    entityName: raw.entityName || '',
    isFollowUp: Boolean(raw.isFollowUp),
    needsPermissionCheck: Boolean(raw.needsPermissionCheck),
    reason: raw.reason || '',
  }
}
