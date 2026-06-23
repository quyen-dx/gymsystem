import mongoose from 'mongoose'

const chatMessageSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        userId: { type: String, required: true },
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, default: '' },
        answer: { type: String, default: undefined },
        type: { type: String, default: undefined },
        plan: { type: mongoose.Schema.Types.Mixed, default: undefined },
        plans: { type: mongoose.Schema.Types.Mixed, default: undefined },
        recommendedPlan: { type: mongoose.Schema.Types.Mixed, default: undefined },
        alternatives: { type: mongoose.Schema.Types.Mixed, default: undefined },
        reason: { type: String, default: undefined },
        conclusion: { type: String, default: undefined },
        data: { type: mongoose.Schema.Types.Mixed, default: undefined },
        planPayload: { type: mongoose.Schema.Types.Mixed, default: undefined },
        intent: { type: String, default: undefined },
        action: { type: String, default: undefined },
        metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
        createdAt: { type: String, required: true },
        suggestions: { type: [String], default: undefined },
        webSearch: { type: mongoose.Schema.Types.Mixed, default: undefined },
        attachments: { type: mongoose.Schema.Types.Mixed, default: undefined },
    },
    { _id: false },
)

const chatSessionSchema = new mongoose.Schema(
    {
        sessionId: { type: String, required: true },
        title: { type: String, default: 'New Chat' },
        createdAt: { type: String, required: true },
        messages: [chatMessageSchema],
    },
    { _id: false },
)

const aiChatHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        sessions: [chatSessionSchema],
        activeSessionId: { type: String, default: '' },
    },
    { timestamps: true },
)

export default mongoose.model('AiChatHistory', aiChatHistorySchema)
