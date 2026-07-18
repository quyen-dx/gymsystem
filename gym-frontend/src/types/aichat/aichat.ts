export type PlanPayloadPlan = {
    _id: string
    nameVi: string
    price: number
    durationDays: number
    descriptionVi?: string
    featuresVi?: string[]
    color: string
}

export type SmartRecommendPT = {
    _id: string
    name: string
    avatar?: string
    specialties?: string[]
    rating?: number
    experienceYears?: number
    totalSessions?: number
    reason?: string[]
    score?: number
}

export type SmartRecommendProduct = {
    _id: string
    name: string
    price: number
    image?: string
    category?: string
    rating?: number
    reason?: string[]
    score?: number
}

export type WorkoutAnalysisData = {
    period: string
    goal: string
    goalLabel: string
    strengths: string[]
    improvements: string[]
    insights: string[]
    tip: string
    topWorkoutTypes: { type: string; label: string; count: number }[]
    stats: {
        period: string
        totalWorkouts: number
        totalDuration: number
        totalCalories: number
        activeDays: number
        daysInPeriod: number
        frequencyPerWeek: number
        longestStreak: number
        currentStreak: number
        avgDurationPerSession: number
        avgCaloriesPerSession: number
        workoutTypes: { type: string; count: number }[]
        completionRate: number
    }
    recentLogs?: any[]
}

export type WorkoutPlanData = {
    goal: string
    goalLabel: string
    level: string
    frequency: number
    durationPerSession: number
    weeklySchedule: {
        day: string
        focus: string
        exercises: { name: string; sets: number; reps: number | string; duration?: number }[]
    }[]
    tips: string[]
    nutritionTip: string
}

export type SmartRecommendPayload = {
    type: 'smart_recommend'
    goal: string
    goalLabel: string
    language: string
    recommendedPlan: PlanPayloadPlan & { reason?: string[]; score?: number } | null
    recommendedPT: SmartRecommendPT | null
    recommendedProduct: SmartRecommendProduct | null
    alternatives: {
        plans: PlanPayloadPlan[]
        pts: { _id: string; name: string; avatar?: string }[]
        products: { _id: string; name: string; price: number; image?: string }[]
    }
    summary: string
    suggestions: string[]
}

export type PlanPayload =
    | { type: 'plan_detail'; plan: PlanPayloadPlan }
    | { type: 'plan_list'; plans: PlanPayloadPlan[] }
    | { type: 'plan_compare_two'; plans: PlanPayloadPlan[]; conclusion?: string }
    | { type: 'plan_compare_all'; plans: PlanPayloadPlan[] }
    | { type: 'plan_recommend'; recommendedPlan: PlanPayloadPlan; reason?: string | string[]; conclusion?: string; alternatives?: PlanPayloadPlan[] }
    | { type: 'ai_advice'; answer: string; suggestions?: string[] }
    | SmartRecommendPayload
    | { type: 'workout_analyzer'; analysis: WorkoutAnalysisData; answer: string }
    | { type: 'workout_plan'; plan: WorkoutPlanData; answer?: string }

export type ChatResponseType =
    | 'text_advice'
    | 'unclear_question'
    | 'plan_recommend'
    | 'plan_detail'
    | 'plan_list'
    | 'plan_compare'
    | 'plan_compare_two'
    | 'plan_compare_all'
    | 'schedule_info'
    | 'health_advice'
    | 'nutrition_advice'
    | 'nutrition_advice_with_sources'
    | 'workout_advice'
    | 'checkin_summary'
    | 'pt_list'
    | 'pt_detail'
    | 'pt_advice'
    | 'pt_advice_no_data'
    | 'pt_availability'
    | 'booking_list'
    | 'booking_suggestion'
    | 'workout_progress'
    | 'health_summary'
    | 'product_list'
    | 'product_recommend'
    | 'notification_list'
    | 'navigation_answer'
    | 'policy_answer'
    | 'policy_refund'
    | 'policy_privacy'
    | 'policy_payment'
    | 'admin_dashboard'
    | 'report_summary'
    | 'action_result'
    | 'smart_recommend'
    | 'workout_analyzer'
    | 'workout_plan'

export type ChatMessage = {
    id: string
    userId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    answer?: string
    type?: ChatResponseType
    plan?: PlanPayloadPlan
    recommendedPlan?: PlanPayloadPlan
    alternatives?: PlanPayloadPlan[]
    reason?: string | string[]
    conclusion?: string
    data?: Record<string, unknown>
    cards?: unknown[]
    links?: {
        label: string
        path: string
        allowedRoles?: string[]
        featureFlag?: string | null
    }[]
    aiAction?: {
        action?: string
        color?: string
        themeName?: string
        path?: string
        message?: string
    } | null
    createdAt: string
    suggestions?: string[]
    sources?: AiSource[]
    webSearch?: WebSearchPayload
    intent?: string
    subject?: string
    action?: string
    metadata?: Record<string, unknown>
    planPayload?: PlanPayload
    plans?: PlanPayloadPlan[]
    attachments?: ChatAttachment[]
}

export type AiSource = {
    title?: string
    url?: string
    domain?: string
    favicon?: string
    sourceTitle?: string
    sourceUrl?: string
    sourceDomain?: string
}

export type ChatAttachment = {
    type: 'image'
    url: string
    name?: string
    mimeType?: string
    size?: number
}

export type ConversationContext = {
    conversationId?: string
    sessionId?: string
    recentMessages: Pick<ChatMessage, 'role' | 'content' | 'createdAt' | 'intent' | 'subject' | 'action'>[]
    lastIntent?: string
    lastSubject?: string
    lastAction?: string
    lastThemeAction?: {
        themeName?: string
        color?: string
    }
    lastSearchQuery?: string
    lastMode?: string
    lastProduct?: string
}

export type WebSearchResult = {
    title?: string
    url: string
    domain?: string
    favicon?: string
    sourceTitle?: string
    sourceUrl?: string
    sourceDomain?: string
    content?: string
    score?: number
}

export type WebSearchPayload = {
    needed?: boolean
    used?: boolean
    reason?: string
    results?: WebSearchResult[]
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
        items: {
            name: string
            avatar: string
            phone: string
            email: string
            specialty: string
            experienceYears?: number
            rating?: number
            schedule?: string
            scheduleRaw?: { dayOfWeek: number; shift: string }[]
        }[]
    }
    | {
        type: 'category_list'
        items: { name: string; slug: string }[]
    }
    | {
        type: 'empty'
        message: string
    }
