# AI Assistant Module

- **Owner**: AI Team
- **Dependencies**: Auth Module, Content Module, Product Module, Order Module, System Settings Module
- **Related Documents**: AI_ARCHITECTURE.md, AI_WORKFLOW.md

## Purpose

Provide an intelligent conversational assistant capable of understanding user intent, answering questions, executing actions across the system, and learning from feedback. The AI assistant serves members (general queries, account help) and staff (operations, reporting).

## Models

- **AIConversation**: Represents a chat session. Fields include userId, sessionId, context (JSON — current page, active order, etc.), status (active, closed, expired), startedAt, lastActivityAt. Conversations auto-expire after inactivity.
- **AIMessage**: Individual messages within a conversation. Fields include conversationId, role (user, assistant, system), content, metadata (intent, confidence, tokens used), toolCalls (if any), createdAt.
- **AIEmbedding**: Vector embeddings for RAG (Retrieval-Augmented Generation). Stores embeddings for content, products, FAQs, and other knowledge base items. Used for semantic search.
- **AIFeedback**: User feedback on assistant responses. Fields include messageId, rating (helpful/not helpful), comment, category (correctness, relevance, tone), createdAt. Used for continuous improvement.
- **AIModelConfig**: Configuration for AI model providers. Fields include provider (OpenAI, Gemini, Claude), model name, temperature, max tokens, system prompt, enabled status. Allows runtime model switching.

## Services

- **aiService**: High-level orchestrator. Receives user messages, manages conversation context, coordinates sub-services, and returns responses. Handles streaming responses via SSE.
- **aiOrchestrator**: Routes messages through the AI pipeline: context gathering → intent classification → permission check → tool execution → response generation → feedback logging.
- **intentClassifier**: Classifies user messages into intents (greeting, faq, order_status, product_search, account_help, report_request, etc.) with confidence scoring.
- **permissionEngine**: Validates whether the current user is authorized to perform the action the AI is about to execute. Enforces role-based and ownership-based checks.
- **contextBuilder**: Gathers relevant context from current session (user profile, current page, active order, recent interactions) and knowledge base (semantic search) to enrich the AI prompt.
- **toolRouter**: Maps classified intents to system functions. Executes tool calls (lookup orders, search products, get reports, update settings) and returns structured results for response generation.

### Architecture Overview

```
User Message
    │
    ▼
contextBuilder ──► intentClassifier ──► permissionEngine ──► toolRouter ──► LLM
    ▲                                                              │            │
    └──────────── knowledge base (embeddings) ◄────────────────────┘◄──────────┘
                                                                                │
                                                                                ▼
                                                                          aiService
                                                                          (response)
```

Full details in AI_ARCHITECTURE.md and AI_WORKFLOW.md.

## Key Flows

1. **Chat**: User sends message → aiService creates/continues conversation → contextBuilder gathers context → intentClassifier predicts intent → permissionEngine verifies access → toolRouter executes (if needed) → LLM generates response → conversation and message persisted → response streamed to client.
2. **Feedback**: User rates response → AIFeedback created → periodically reviewed for fine-tuning and prompt adjustments.
3. **Knowledge Sync**: Admin publishes content → embeddings regenerated for updated items → vector store updated → available for future semantic queries.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /ai/chat | User | Send message to AI assistant (streaming SSE response) |
| GET | /ai/history | User | List conversation history (paginated) |
| GET | /ai/history/:conversationId | User | Get full conversation messages |
| DELETE | /ai/history | User | Clear all conversation history |
| DELETE | /ai/history/:conversationId | User | Delete specific conversation |
| POST | /ai/feedback | User | Submit feedback on AI response |
| GET | /ai/config | Admin | Get current AI model configuration |
| PUT | /ai/config | Admin | Update AI model configuration |

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| AI_001 | Conversation not found | Conversation ID does not exist or expired |
| AI_002 | Message too long | User message exceeds maximum length |
| AI_003 | Rate limited | Too many AI requests in a short period |
| AI_004 | Model unavailable | Configured AI model is not accessible |
| AI_005 | Intent not recognized | Could not classify user intent with sufficient confidence |
| AI_006 | Permission denied | User not authorized for requested action |
| AI_007 | Tool execution failed | Backend operation invoked by AI failed |

## Future

- Proactive suggestions (AI initiates helpful prompts based on user behavior)
- Voice input support
- Multi-language assistant
- Admin analytics dashboard (popular questions, satisfaction trends)
- Custom knowledge base upload (PDF, DOCX ingestion)
- Fine-tuned domain-specific model
