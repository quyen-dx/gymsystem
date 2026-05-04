import mongoose from 'mongoose'

const chatMessageSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        userId: { type: String, required: true },
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        createdAt: { type: String, required: true },
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
