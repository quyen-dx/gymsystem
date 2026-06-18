export function parseJsonLikeString(value: unknown): any {
    if (typeof value !== 'string') return value

    const trimmed = value.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return value
    }

    try {
        return JSON.parse(trimmed)
    } catch {
        return value
    }
}

export function extractAiAnswer(data: unknown): string {
    if (!data) return 'Không nhận được phản hồi.'

    // Nếu response là string JSON
    const parsedData = parseJsonLikeString(data)

    if (typeof parsedData === 'string') return parsedData

    // Nếu data.answer lại là string JSON
    const parsedAnswer = parseJsonLikeString(parsedData.answer)

    if (typeof parsedAnswer === 'object' && parsedAnswer !== null && parsedAnswer?.answer) {
        return parsedAnswer.answer
    }

    if (typeof parsedData.answer === 'string') {
        return parsedData.answer
    }

    if (typeof parsedData.data?.answer === 'string') {
        return parsedData.data.answer
    }

    if (typeof parsedData.message === 'string') {
        return parsedData.message
    }

    if (typeof parsedData.text === 'string') {
        return parsedData.text
    }

    return 'Phản hồi AI chưa đúng định dạng.'
}

export const stripUnsafeModelOutput = (value: unknown): string => {
    if (typeof value !== 'string') return extractAiAnswer(value)
    
    const cleaned = String(value || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/^```[a-z0-9_-]*\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
        
    const extracted = extractAiAnswer(cleaned)
    if (extracted !== 'Phản hồi AI chưa đúng định dạng.' && extracted !== 'Không nhận được phản hồi.') {
        return extracted
    }

    if (/^\s*\{[\s\S]*\}\s*$/.test(cleaned)) {
        try {
            const parsed = JSON.parse(cleaned)
            if (typeof parsed?.answer === 'string') return parsed.answer.trim()
            if (typeof parsed?.message === 'string') return parsed.message.trim()
            if (typeof parsed?.text === 'string') return parsed.text.trim()
            return cleaned
        } catch {
            return cleaned
        }
    }
    return cleaned
}
