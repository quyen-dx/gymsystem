// Entity Resolver: Match user references to actual entities (PTs, plans, etc.)
// Handles fuzzy matching, positional references ("first", "second"), and name normalization

const normalize = (str = '') => String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()

const levenshteinDistance = (a, b) => {
    const aLen = a.length
    const bLen = b.length
    const dp = Array(bLen + 1).fill(0).map(() => Array(aLen + 1).fill(0))
    for (let i = 0; i <= aLen; i++) dp[0][i] = i
    for (let j = 0; j <= bLen; j++) dp[j][0] = j
    for (let j = 1; j <= bLen; j++) {
        for (let i = 1; i <= aLen; i++) {
            if (a[i - 1] === b[j - 1]) {
                dp[j][i] = dp[j - 1][i - 1]
            } else {
                dp[j][i] = Math.min(dp[j - 1][i], dp[j][i - 1], dp[j - 1][i - 1]) + 1
            }
        }
    }
    return dp[bLen][aLen]
}

const fuzzyMatch = (query, entities, threshold = 0.6) => {
    if (!query || !entities || entities.length === 0) return null
    const nQuery = normalize(query)
    const queryTokens = nQuery.split(/\s+/).filter((token) => token.length >= 2)
    let best = null
    let bestScore = 0
    for (const entity of entities) {
        const names = [entity.name, entity.nameVi, entity.nameEn].filter(Boolean).map(normalize)
        for (const name of names) {
            if (!name) continue
            // Exact match
            if (nQuery === name) return entity

            const nameTokens = name.split(/\s+/).filter((token) => token.length >= 2)
            const tokenOverlap = queryTokens.filter((token) => nameTokens.includes(token)).length
            const queryCoverage = queryTokens.length > 0 ? tokenOverlap / queryTokens.length : 0
            const nameCoverage = nameTokens.length > 0 ? tokenOverlap / nameTokens.length : 0

            // Safe substring match. Short aliases like "VIP" are valid only when the
            // user reference is also short; they must not steal long unknown names.
            if (name.includes(nQuery) || nQuery.includes(name)) {
                const shorter = Math.min(nQuery.length, name.length)
                const longer = Math.max(nQuery.length, name.length)
                const lengthRatio = shorter / longer
                const shortExactAlias = nQuery.length <= 12 && name.includes(nQuery)
                const nearFullName = lengthRatio >= 0.72 || (queryCoverage >= 0.75 && nameCoverage >= 0.75)
                if ((shortExactAlias || nearFullName) && !(name.length <= 5 && nQuery.length > 12)) {
                    const score = Math.max(0.8, Math.min(0.98, lengthRatio + Math.min(queryCoverage, nameCoverage) * 0.2))
                    if (score > bestScore) {
                        bestScore = score
                        best = entity
                    }
                    continue
                }
            }

            // Levenshtein distance with a higher effective floor for long names.
            const maxLen = Math.max(nQuery.length, name.length)
            const distance = levenshteinDistance(nQuery, name)
            const score = (maxLen - distance) / maxLen
            const effectiveThreshold = maxLen >= 12 ? Math.max(threshold, 0.78) : threshold
            if (score >= effectiveThreshold && score > bestScore) {
                bestScore = score
                best = entity
            }
        }
    }
    return best
}

const detectPositionalReference = (query) => {
    const n = normalize(query)
    // Match "first", "1st", "đầu tiên", etc.
    if (/\b(dau tien|thu nhat|first|1st|1|thu 1)\b/.test(n)) return 0
    if (/\b(thu hai|thu 2|second|2nd|2)\b/.test(n)) return 1
    if (/\b(thu ba|thu 3|third|3rd|3)\b/.test(n)) return 2
    if (/\b(thu tu|thu 4|fourth|4th|4)\b/.test(n)) return 3
    if (/\b(thu nam|thu 5|fifth|5th|5)\b/.test(n)) return 4
    if (/\b(cuoi cung|last)\b/.test(n)) return -1 // last
    return null
}

const detectCountReference = (query) => {
    const n = normalize(query)
    const countMatch = n.match(/\b(\d+)\s*(cai|thu|no|entities?|items?)?/i)
    if (countMatch && countMatch[1]) {
        const count = parseInt(countMatch[1], 10)
        if (count >= 1 && count <= 10) return count
    }
    return null
}

const resolveEntityReference = ({
    userReference, // user's mention: "cgpt 1", "người đầu tiên", "nó", "gói VIP"
    lastListedEntities = [], // array of entities from last response
    entityType = 'pt', // 'pt' | 'plan'
    query = '',
}) => {
    if (!userReference || !lastListedEntities || lastListedEntities.length === 0) {
        return { resolved: null, match: null, method: null, confidence: 0 }
    }

    // 1. Direct name match via fuzzy matching. Do this before positional matching so names
    // like "cgpt 1" are not mistaken for "the first item".
    const matched = fuzzyMatch(userReference, lastListedEntities, 0.72)
    if (matched) {
        const distance = levenshteinDistance(normalize(userReference), normalize(matched.name || matched.nameVi || matched.nameEn))
        const maxLen = Math.max(
            userReference.length,
            String(matched.name || matched.nameVi || matched.nameEn).length
        )
        const similarity = (maxLen - distance) / maxLen
        return {
            resolved: matched,
            match: matched,
            method: 'fuzzy_match',
            confidence: Math.min(0.99, Math.max(0.65, similarity)),
        }
    }

    // 2. Positional reference: "first", "second", "người thứ 2"
    const position = detectPositionalReference(userReference)
    if (position !== null) {
        if (position === -1) {
            const entity = lastListedEntities[lastListedEntities.length - 1]
            if (entity) return { resolved: entity, match: null, method: 'positional_last', confidence: 0.95 }
        } else if (position >= 0 && position < lastListedEntities.length) {
            const entity = lastListedEntities[position]
            if (entity) return { resolved: entity, match: null, method: 'positional_index', confidence: 0.95 }
        }
    }

    // 3. Count reference: "người thứ 2 trong danh sách" → extract "2"
    const count = detectCountReference(userReference)
    if (count !== null && count > 0 && count <= lastListedEntities.length) {
        const entity = lastListedEntities[count - 1]
        if (entity) return { resolved: entity, match: null, method: 'positional_count', confidence: 0.92 }
    }

    // 4. Anaphora: "nó", "cái đó", "thằng đó" → refer to first/most recent entity
    const n = normalize(userReference)
    if (/\b(no|it|cai do|thang do|guy|dude|that one|that)\b/.test(n)) {
        if (lastListedEntities.length > 0) {
            return { resolved: lastListedEntities[0], match: null, method: 'anaphora', confidence: 0.7 }
        }
    }

    return { resolved: null, match: null, method: null, confidence: 0 }
}

const resolveMultipleReferences = ({
    userReference,
    lastListedEntities = [],
    entityType = 'pt',
    query = '',
}) => {
    // Extract multiple references: "PT 1 và 2" → [PT[0], PT[1]]
    const n = normalize(userReference)
    const positions = []
    const posMatches = n.match(/\b(dau tien|thu nhat|first|1st)\b/gi)
    const secMatches = n.match(/\b(thu hai|thu 2|second|2nd)\b/gi)
    const thirdMatches = n.match(/\b(thu ba|thu 3|third|3rd)\b/gi)

    if (posMatches || n.includes('1')) positions.push(0)
    if (secMatches || n.includes('2')) positions.push(1)
    if (thirdMatches || n.includes('3')) positions.push(2)

    const resolved = []
    for (const pos of positions) {
        if (pos >= 0 && pos < lastListedEntities.length) {
            resolved.push(lastListedEntities[pos])
        }
    }
    return resolved
}

const extractEntityReference = ({
    query = '',
    memory = {},
    conversationContext = {},
}) => {
    // Extract what the user is referring to in their query
    const n = normalize(query)

    // Pattern: "chi tiet ve [entity]" → extract entity name
    // "chi tiet cgpt 1" → "cgpt 1"
    // "chi tiet ve PT cgpt 1" → "cgpt 1"
    // "ai la nguoi thu hai" → positional ref
    // "thong tin cua juan" → "juan"

    let reference = null

    // Try: "chi tiet <name>" or "thong tin <name>" patterns
    const detailMatch = n.match(/\b(chi tiet|thong tin|gioi thieu|profile|ho so|ve)\s+(?:pt|plan|goi|chuong trinh)?\s*(.+?)(?:\?|$)/i)
    if (detailMatch && detailMatch[2]) {
        reference = detailMatch[2].trim()
    }

    // Try: after "PT", "plan", "goi" etc.
    if (!reference) {
        const typeMatch = n.match(/\b(pt|plan|goi|trainer|coach)\s+(.+?)(?:\?|$)/i)
        if (typeMatch && typeMatch[2]) {
            reference = typeMatch[2].trim()
        }
    }

    // Try: "cua <name>" (of <name>)
    if (!reference) {
        const ofMatch = n.match(/\bcua\s+(.+?)(?:\?|$)/i)
        if (ofMatch && ofMatch[1]) {
            reference = ofMatch[1].trim()
        }
    }

    return reference
}

export const entityResolver = {
    // Resolve a single entity reference to an actual entity
    resolve: resolveEntityReference,

    // Resolve multiple entity references from a query
    resolveMultiple: resolveMultipleReferences,

    // Extract entity reference from query text
    extractReference: extractEntityReference,

    // Utility: fuzzy match
    fuzzyMatch,

    // Utility: normalize text
    normalize,
}
