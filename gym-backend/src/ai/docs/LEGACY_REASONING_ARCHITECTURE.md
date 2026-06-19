# LLM-Based Query Reasoning for GymPro AI

## Overview

GymProAgent now uses **LLM-based reasoning** to understand follow-up questions without hard-coded keywords. Instead of checking for patterns like `if query.includes("chi tiết")`, the system:

> Legacy note: this file is historical. Current production behavior must follow Constitutional AI + Database First:
> Permission/Auth check -> Current user context -> Database/fresh tool result -> Valid cache -> Memory for entity/context only -> Internal docs/navigation/FAQ/policy -> Web search -> LLM knowledge.
> Memory must never override database for dynamic GymPro data.

1. Uses Claude LLM to deeply understand user intent
2. Stores context (entities shown in last response) in memory
3. Resolves user references (names, positions, pronouns) to actual entities
4. Handles follow-ups naturally, like ChatGPT

## Architecture

```
User Message
     ↓
[Query Understanding] ← Uses memory only to resolve references
     ↓
[Permission/Auth Check]
     ↓
[Entity Resolver] ← Matches user reference to actual entity
     ↓
[Tool Planner] ← Determines which tools to call
     ↓
[Tool Executor] ← Calls API/DB tools
     ↓
[Answer Builder] ← Generates response
     ↓
[Constitutional Reviewer] ← Blocks hallucination, wrong fallback, privacy/render violations
     ↓
[Memory Update] ← Saves listed entities for next turn
```

## Key Components

### 1. Query Reasoner (`queryReasoner.js`)

**What it does:**
- Analyzes user query using LLM deep reasoning
- Includes available entities from memory in the prompt
- Returns: `{subject, action, intent, entities, isFollowUp, followUpTarget, needsTools}`

**Example:**
```javascript
// User: "chi tiết về cgpt 1"
// Memory: lastListedPTs = [{id: 'pt1', name: 'cgpt 1'}, ...]
const result = await reasonQuery({
  query: 'chi tiết về cgpt 1',
  memory: { lastListedPTs: [...], lastSubject: 'pt' },
});
// Returns:
// {
//   subject: 'pt',
//   action: 'detail',
//   isFollowUp: true,
//   followUpTarget: { type: 'pt', id: 'pt1', name: 'cgpt 1', method: 'name_match' },
//   confidence: 0.92,
// }
```

**LLM System Prompt includes:**
```
Available entities from previous response:
- Available PTs from last list: 1. cgpt 1, 2. juan, 3. abc
- Available Plans from last list: 1. Gói Cơ Bản, 2. Gói VIP, 3. Gói Premium

Deep reasoning:
1. What is the user's true intent?
2. Is this a follow-up to previous context?
3. Does it use positional references (first, second, etc.)?
4. Does it use pronouns/anaphora (it, that, nó, cái đó)?
5. Can I match the user mention to an available entity?
```

### 2. Entity Resolver (`entityResolver.js`)

**What it does:**
- Converts user references to actual entity IDs
- Handles fuzzy matching, positional references, pronouns
- Returns: `{resolved, method, confidence}`

**Supported Resolution Methods:**

| Method | Example | Resolution |
|--------|---------|-----------|
| **Exact Match** | "cgpt 1" | Looks for exact name match in list |
| **Fuzzy Match** | "cgpt" | Matches to "cgpt 1" using Levenshtein distance |
| **Substring Match** | "juan" | Matches to entity containing "juan" |
| **Positional** | "người đầu tiên" | Resolves to first PT (index 0) |
| **Positional (second)** | "thu hai", "thứ 2" | Resolves to second PT (index 1) |
| **Positional (last)** | "cuối cùng" | Resolves to last PT in list |
| **Anaphora** | "nó", "cái đó", "it" | Refers to most recent/first entity |
| **Count Ref** | "người thứ 2" | Extracts "2" and resolves to index 1 |

**Example:**
```javascript
const resolution = entityResolver.resolve({
  userReference: 'người thứ 2',
  lastListedEntities: [
    {id: 'pt1', name: 'cgpt 1', ...},
    {id: 'pt2', name: 'juan', ...},
    {id: 'pt3', name: 'abc', ...}
  ],
});
// Returns:
// {
//   resolved: {id: 'pt2', name: 'juan', ...},
//   method: 'positional_index',
//   confidence: 0.95
// }
```

### 3. Agent Memory (`agentMemory.js`)

**Enhanced to store:**
```javascript
{
  // Existing fields...
  
  // NEW: Last listed entities
  lastListedPTs: [
    {id, name, email, phone, specialties, experienceYears, rating, bio, schedule}
  ],
  lastListedPlans: [
    {id, nameVi, nameEn, price, durationDays}
  ],
  lastListedProducts: [
    {id, name, price, description}
  ],
}
```

This allows the reasoner to reference available entities when analyzing the next query.

### 4. GymPro Agent (`gymProAgent.js`)

**Changes:**
1. **Save entities after responses:**
   ```javascript
   agentMemory.update(userId, conversationId, {
     lastListedPTs: ptItems,  // Save all PTs shown
     lastListedPlans: plans,   // Save all plans shown
   })
   ```

2. **Use followUpTarget for detail mode:**
   ```javascript
   const detailMode = analysis.action === 'detail' 
                   || isPTDetailIntent(queryText) 
                   || (analysis.followUpTarget?.type === 'pt')
   ```

3. **Resolve PT by ID if available:**
   ```javascript
   if (analysis.followUpTarget?.id) {
     selectedPT = ptItems.find((p) => String(p.id) === String(analysis.followUpTarget.id))
   }
   ```

## Conversation Flow Example

### Scenario: User searches for PTs

**Step 1:** User: "có bao nhiêu PT trong gym"
```
AI analyzes: subject=pt, action=list
AI calls: getAvailablePTs()
AI saves memory: lastListedPTs=[cgpt 1, juan, abc, ...]
AI shows: PT list
```

**Step 2:** User: "chi tiết về cgpt 1"
```
LLM Reasoner analyzes:
- Previous subject = 'pt'
- Available entities = [cgpt 1, juan, abc, ...]
- User mentions 'cgpt 1'
- This is a follow-up asking for detail

Returns: {
  subject: 'pt',
  action: 'detail',
  isFollowUp: true,
  followUpTarget: {type: 'pt', id: 'pt1', name: 'cgpt 1', method: 'name_match'}
}

AI shows: PT detail for cgpt 1
```

**Step 3:** User: "người thứ 2 thì sao"
```
Entity Resolver:
- Positional reference: 'thu 2' → index 1
- lastListedPTs[1] = {id: 'pt2', name: 'juan', ...}
- Returns: {resolved: juan, method: 'positional_index'}

AI shows: PT detail for juan
```

**Step 4:** User: "nó chuyên môn gì"
```
Entity Resolver:
- Anaphora: 'nó' refers to last context
- lastListedPTs[0] or memory.lastMentionedPT = juan
- Returns: {resolved: juan, method: 'anaphora'}

AI shows: juan's specialties
```

## Test Cases

Run tests to verify all follow-up patterns:

```bash
node src/ai/agent/entityResolver.test.js
```

**Covered scenarios:**
- ✓ PT list followed by name reference
- ✓ PT list followed by positional reference (first, second, last)
- ✓ PT list followed by anaphora (it, that, nó)
- ✓ PT list followed by fuzzy name match
- ✓ Plan list followed by name reference
- ✓ Plan list followed by positional reference
- ✓ Follow-up with multiple references
- ✓ Cross-entity follow-ups (plan → PT, PT → plan)

## Fallback Strategy

If **LLM provider is unavailable** (timeout, rate limit, error):
1. Query Reasoner falls back to CU layer (rule-based)
2. CU layer uses pattern matching (existing logic preserved)
3. Entity resolution still works with memory
4. System continues to function, with lower confidence

```javascript
try {
  // Try LLM first
  const parsed = await runAIWithFallback({...})
  parsed.source = 'llm'
} catch {
  // Fall back to CU layer
  const cuResult = conversationalUnderstand({...})
  // Return CU result with lower confidence
}
```

## Configuration

### LLM Provider Settings

**In `aiFallbackService.js`:**
- Temperature: 0.1 (precise reasoning)
- Max tokens: 500 (concise output)
- Timeout: 6000ms (6 seconds)

### Entity Resolver Settings

**In `entityResolver.js`:**
- Fuzzy match threshold: 0.6 (60% similarity required)
- Positional reference patterns: documented in code
- Anaphora trigger words: 'no', 'cai do', 'it', 'that', etc.

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| LLM Query Reasoning | ~500-1500ms | Depends on LLM latency |
| Entity Resolver | <10ms | Local string matching |
| Fallback (CU layer) | <50ms | Regex patterns |
| **Total (LLM path)** | ~1-2s | Acceptable for chat |
| **Total (fallback)** | <100ms | Fast response |

## Advantages

1. **No Hard-coded Keywords**: Use LLM reasoning instead of regex patterns
2. **Contextual Understanding**: LLM sees full conversation history
3. **Natural Follow-ups**: Like ChatGPT, users can refer to entities naturally
4. **Fuzzy Matching**: Handles typos and partial names
5. **Positional References**: "First", "second", positional numbers work
6. **Pronoun Resolution**: "It", "that", "nó", "cái đó" work in context
7. **Fallback Included**: If LLM fails, system still works with rule-based router
8. **Extensible**: Easy to add new entity types and resolution methods

## Example Use Cases

### Before (Hard-coded)
```javascript
if (query.includes('chi tiết') && query.includes('pt')) {
  // show PT detail
}
```

### After (LLM)
```javascript
// Works for all these:
- "chi tiết về cgpt 1"
- "cho tôi xem cgpt 1"
- "cgpt 1 là ai"
- "thông tin người đầu tiên"
- "người thứ 2 thì sao"
- "nó chuyên môn gì"
- "hồ sơ của juan"
```

## Future Enhancements

1. **Multi-turn Context**: Track entire conversation thread
2. **Entity Confidence Scoring**: Show confidence for ambiguous matches
3. **Clarification Questions**: "Which cgpt did you mean?" if ambiguous
4. **Cross-entity Relations**: "Does the first plan have PT training?"
5. **Batch Resolution**: "Show details for first 3 PTs"
6. **Semantic Similarity**: Better fuzzy matching with embeddings

## Related Files

- `src/ai/agent/entityResolver.js` - Entity resolution logic
- `src/ai/agent/queryReasoner.js` - LLM-based reasoning
- `src/ai/agent/gymProAgent.js` - Main agent orchestration
- `src/ai/agent/agentMemory.js` - Memory management
- `src/ai/agent/entityResolver.test.js` - Test cases
- `src/ai/services/aiFallbackService.js` - LLM provider abstraction
