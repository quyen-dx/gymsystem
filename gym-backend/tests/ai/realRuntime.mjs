import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import { createPartFromFunctionResponse } from '@google/genai';
import { generateContent } from '../../src/ai/providers/chat/chatProvider.js';
import { getAllDeclarations } from '../../src/ai/utils/toolRegistry.js';
import { databaseQuery } from '../../src/ai/tools/databaseTool.js';
import { loadMemory, buildMemoryPrompt } from '../../src/ai/memory/conversationMemory.js';
import { loadContext, buildContextPrompt } from '../../src/ai/context/conversationContext.js';
import { getSystemPrompt } from '../../src/ai/prompts/systemPromptLoader.js';

// Load env
const envText = readFileSync('.env', 'utf-8');
function gEnv(n) { const r = new RegExp('^' + n + '=(.+)$', 'm'); const m = envText.match(r); return m ? m[1].trim() : ''; }
process.env.GOOGLE_ENABLED = 'true';
process.env.GOOGLE_MODELS = gEnv('GOOGLE_MODELS') || 'gemini-flash-latest,gemini-flash-lite-latest';
process.env.GOOGLE_API_KEYS = gEnv('GOOGLE_API_KEYS') || gEnv('GEMINI_API_KEYS') || '';
process.env.CHAT_PROVIDER = 'google';
process.env.CHAT_PROVIDER_ORDER = '';
process.env.MONGO_URI = gEnv('MONGO_URI');
process.env.MEMORY_PROVIDER = 'memory';
process.env.MEMORY_TTL = '30';
process.env.CONTEXT_TTL = '10';

console.log('Connecting to MongoDB...');
await mongoose.connect(process.env.MONGO_URI);
console.log('Connected.');

// Use the REAL system prompt and tools
const systemPrompt = getSystemPrompt();
const allTools = getAllDeclarations();
console.log('Tools loaded:', allTools.length + ' declarations');

// Build contents EXACTLY like buildContents in aiAssistantService
const message = 'Ví tôi còn bao nhiêu?';
const user = { _id: new mongoose.Types.ObjectId(), role: 'member', fullName: 'Test User' };
const roleLabel = 'Hội viên';
const userName = 'Test User';

const resolvedPrompt = systemPrompt
  .replace(/\{\{userName\}\}/g, userName)
  .replace(/\{\{userRoleLabel\}\}/g, roleLabel);

const prefix = [];
try {
  const mem = loadMemory(user._id.toString());
  if (mem) prefix.push(buildMemoryPrompt(mem));
} catch {}
try {
  const ctx = loadContext(user._id.toString());
  if (ctx) prefix.push(buildContextPrompt(ctx));
} catch {}
const prefixStr = prefix.filter(Boolean).join('\n') ? prefix.filter(Boolean).join('\n') + '\n\n' : '';
const userPart = `${prefixStr}${resolvedPrompt}\n\n[USER_MESSAGE]\n${message}\n[/USER_MESSAGE]`;

const contents = [{ role: 'user', parts: [{ text: userPart }] }];
const tools = [{ functionDeclarations: allTools }];

console.log('System prompt length:', resolvedPrompt.length);
console.log('User part length:', userPart.length);
console.log();

// REQUEST #1
console.log('>>> REQUEST #1');
const response = await generateContent({
  contents,
  config: { temperature: 0.1, tools },
});

const part = response?.candidates?.[0]?.content?.parts?.[0];

if (part?.functionCall) {
  const { name, args, id } = part.functionCall;
  console.log('Function call:', name, 'args:', JSON.stringify(args).substring(0, 120));

  // Execute the REAL tool
  let result;
  if (name === 'vectorQuery') {
    const { vectorQuery } = await import('../../src/ai/tools/vectorTool.js');
    result = await vectorQuery(args?.query);
  } else if (name === 'webQuery') {
    const { webQuery } = await import('../../src/ai/tools/webTool.js');
    result = await webQuery(args?.query);
  } else {
    result = await databaseQuery(args?.intent, user);
  }

  console.log('Tool result:', JSON.stringify(result).substring(0, 200));
  console.log('Result type:', typeof result);
  console.log('Result keys:', result ? Object.keys(result) : 'NULL/UNDEFINED');

  // REQUEST #2
  console.log();
  console.log('>>> REQUEST #2 (function response)');

  const frPart = createPartFromFunctionResponse(id, name, result);
  console.log('frPart:', JSON.stringify(frPart).substring(0, 300));

  const functionResponseContent = {
    role: 'user',
    parts: [frPart],
  };

  try {
    const finalResponse = await generateContent({
      contents: [...contents, functionResponseContent],
      config: { temperature: 0.1, tools },
    });
    const text = finalResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('SUCCESS:', text.substring(0, 200));
  } catch (err) {
    console.error('REQUEST #2 ERROR:', err.message?.substring(0, 500));
  }
} else {
  console.log('No function call. Text:', (response?.text || '').substring(0, 100));
}

await mongoose.disconnect();
