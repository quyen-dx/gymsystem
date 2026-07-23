import { DATABASE_QUERY_DECLARATION } from '../tools/databaseTool.js'
import { WEB_QUERY_DECLARATION } from '../tools/webTool.js'
import { VECTOR_QUERY_DECLARATION } from '../tools/vectorTool.js'

export function getAllDeclarations() {
  return [DATABASE_QUERY_DECLARATION, WEB_QUERY_DECLARATION, VECTOR_QUERY_DECLARATION]
}
