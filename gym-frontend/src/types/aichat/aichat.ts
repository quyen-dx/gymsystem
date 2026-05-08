export type ChatMessage = {
    id: string
    userId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    createdAt: string
}

export type StoredChatState = {
    sessions: ChatSession[]
    activeSessionId?: string
}

export type ChatSession = {
    sessionId: string
    title: string
    createdAt: string
    messages: ChatMessage[]
}

export type MascotPosition = {
    x: number
    y: number
}

export type DragState = {
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
    source?: 'trigger' | 'panel'
}

export type AiToolPayload =
    | {
        type: 'product_list'
        items: { name: string; price: number; image: string; link: string; selectedVariant?: string }[]
        message?: string
    }
    | {
        type: 'pt_list'
        items: { name: string; avatar: string; phone: string; email: string; specialty: string }[]
    }
    | {
        type: 'category_list'
        items: { name: string; slug: string }[]
    }
    | {
        type: 'empty'
        message: string
    }
