import logger from '../config/logger.js'
import { AIToolNotFoundError, AIToolExecutionError } from './aiErrors.js'

const tools = new Map()

export const registerTool = (name, handler, schema = null) => {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('Tool name must be a non-empty string')
  }
  if (typeof handler !== 'function') {
    throw new Error('Tool handler must be a function')
  }
  if (tools.has(name)) {
    logger.warn(`Tool '${name}' already registered — overwriting`)
  }
  tools.set(name, { handler, schema })
  logger.info(`AI tool registered: ${name}`)
}

export const getTool = (name) => {
  const tool = tools.get(name)
  if (!tool) {
    return undefined
  }
  return tool
}

export const executeTool = async (name, params) => {
  const tool = tools.get(name)
  if (!tool) {
    throw new AIToolNotFoundError(name)
  }

  if (tool.schema) {
    const result = tool.schema.safeParse(params)
    if (!result.success) {
      throw new AIToolExecutionError(
        name,
        `Parameter validation failed: ${result.error.message}`,
      )
    }
    params = result.data
  }

  try {
    return await tool.handler(params)
  } catch (error) {
    if (error instanceof AIToolNotFoundError || error instanceof AIToolExecutionError) {
      throw error
    }
    throw new AIToolExecutionError(name, error.message)
  }
}

export const listTools = () => {
  return Array.from(tools.entries()).map(([name, { schema }]) => ({
    name,
    hasSchema: schema !== null,
  }))
}

export const hasTool = (name) => tools.has(name)

export const removeTool = (name) => {
  const existed = tools.delete(name)
  if (existed) {
    logger.info(`AI tool removed: ${name}`)
  }
  return existed
}

export default {
  registerTool,
  getTool,
  executeTool,
  listTools,
  hasTool,
  removeTool,
}
