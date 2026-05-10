import mongoose from 'mongoose'

const topicSchema = new mongoose.Schema(
    {
        topic: { type: String, required: true },
        count: { type: Number, default: 0, min: 0 },
    },
    { _id: false },
)

const aiUserMemorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        preferences: {
            favoriteMode: {
                type: String,
                enum: ['gym', 'shop', 'general', 'search'],
                default: 'gym',
            },
            responseStyle: {
                type: String,
                enum: ['short', 'long', 'balanced'],
                default: 'balanced',
            },
        },
        historySummary: { type: String, default: '' },
        usagePattern: {
            topTopics: { type: [topicSchema], default: [] },
            lastTopics: { type: [String], default: [] },
        },
        analyzedMessageCount: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true },
)

export default mongoose.model('AiUserMemory', aiUserMemorySchema)
