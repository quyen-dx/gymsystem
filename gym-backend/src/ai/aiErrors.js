import AppError from '../utils/appError.js'

export class AIProviderError extends AppError {
  constructor(message, statusCode = 503, errorCode = 'AI_PROVIDER_ERROR') {
    super(message, statusCode, errorCode)
  }
}

export class AIProviderUnavailableError extends AIProviderError {
  constructor(provider, cause) {
    super(
      `AI provider '${provider}' is unavailable: ${cause}`,
      503,
      'AI_PROVIDER_UNAVAILABLE',
    )
    this.provider = provider
    this.cause = cause
  }
}

export class AIProviderQuotaError extends AIProviderError {
  constructor(provider) {
    super(
      `AI provider '${provider}' has exceeded its quota`,
      429,
      'AI_PROVIDER_QUOTA_EXCEEDED',
    )
    this.provider = provider
  }
}

export class AIToolNotFoundError extends AIProviderError {
  constructor(toolName) {
    super(`AI tool '${toolName}' not found`, 404, 'AI_TOOL_NOT_FOUND')
    this.toolName = toolName
  }
}

export class AIToolExecutionError extends AIProviderError {
  constructor(toolName, cause) {
    super(`AI tool '${toolName}' execution failed: ${cause}`, 500, 'AI_TOOL_EXECUTION_ERROR')
    this.toolName = toolName
    this.cause = cause
  }
}

export default {
  AIProviderError,
  AIProviderUnavailableError,
  AIProviderQuotaError,
  AIToolNotFoundError,
  AIToolExecutionError,
}
