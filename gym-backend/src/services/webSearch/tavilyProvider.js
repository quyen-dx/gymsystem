import axios from 'axios'

const TAVILY_API_URL = 'https://api.tavily.com/search'

const TRUSTED_DOMAINS = [
  'who.int',
  'nih.gov',
  'mayoclinic.org',
  'healthline.com',
  'examine.com',
  'verywellfit.com',
]

function isTrusted(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return TRUSTED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))
  } catch {
    return false
  }
}

function prioritize(results) {
  const trusted = results.filter((r) => isTrusted(r.url))
  const other = results.filter((r) => !isTrusted(r.url))
  return [...trusted, ...other]
}

export async function search(query) {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    console.error('[TavilyProvider] TAVILY_API_KEY not configured')
    return []
  }

  try {
    const { data } = await axios.post(TAVILY_API_URL, {
      api_key: apiKey,
      query,
      search_depth: 'basic',
      include_answer: false,
      max_results: 5,
    })

    if (!data?.results?.length) return []

    const results = data.results.map((r) => ({
      source: r.url || '',
      title: r.title || '',
      content: r.content || '',
      url: r.url || '',
    }))

    return prioritize(results)
  } catch (err) {
    console.error('[TavilyProvider] API error:', err.message)
    return []
  }
}
