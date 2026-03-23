---
name: Full Stack Web AI Integration
description: Skill for integrating and using Gemini and Claude AI in a full stack web environment
---

# Full Stack Web Development with AI

This skill provides instructions for developing and maintaining the full stack web application with Gemini and Claude AI models.

## Environment Setup
Make sure the following environment variables are set in your backend `.env` file:
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`

## Backend Integration
When integrating AI models in the backend (e.g., `gym-backend`):
1. **Gemini**: Use the `@google/genai` package. Ideal for multi-modal tasks, content generation, and code explanation.
2. **Claude**: Use the `@anthropic-ai/sdk` package. Ideal for complex reasoning, long-context analysis, and structuring JSON responses.

Run these to install:
```bash
npm install @google/genai @anthropic-ai/sdk
```

## Prompt Engineering Guidelines
- Keep prompts structured and specific.
- Perform the AI operations on the backend to keep API keys secure.
- Expose REST or GraphQL endpoints for the frontend to consume.

## Frontend UI Interaction
When building UI for AI on the frontend (e.g., `gym-frontend`):
- Implement loading states (spinners/skeletons) while awaiting AI responses.
- Handle streaming responses if the backend supports it (Server-Sent Events or WebSockets).
- Gracefully handle errors and rate-limits from the AI APIs.
