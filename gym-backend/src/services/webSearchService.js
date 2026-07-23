import { search as tavilySearch } from './webSearch/tavilyProvider.js'

export async function search(query) {
  return tavilySearch(query)
}
