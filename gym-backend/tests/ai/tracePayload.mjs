import { GoogleGenAI, createPartFromFunctionResponse } from '@google/genai';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf-8');
const keyMatch = env.match(/^GEMINI_API_KEYS=(.+)/m);
const modelMatch = env.match(/^GOOGLE_MODELS=(.+)/m);
const apiKey = (keyMatch?.[1] || '').split(',')[0].trim();
const models = (modelMatch?.[1] || 'gemini-3.6-flash').split(',').map(s => s.trim()).filter(Boolean);
const model = models[0];

console.log('Model:', model);
console.log('API key prefix:', apiKey.substring(0, 12) + '...');

const g = new GoogleGenAI({ apiKey });

// ----------- INTERCEPTOR -----------
const orig = g.models.apiClient.request.bind(g.models.apiClient);
let callNum = 0;

g.models.apiClient.request = async (opts) => {
  callNum++;
  if (opts.body) {
    const body = JSON.parse(opts.body);
    console.log('\n========== PAYLOAD #' + callNum + ' ==========');
    console.log('Path:', opts.path);
    if (body.contents) {
      console.log('Contents: ' + body.contents.length + ' items');
      body.contents.forEach((c, i) => {
        console.log('  [' + i + '] role:', c.role, '| parts:', (c.parts || []).length);
        (c.parts || []).forEach((p, j) => {
          const types = Object.keys(p);
          console.log('       [' + i + '][' + j + '] keys:', JSON.stringify(types));
          types.forEach(k => {
            const v = p[k];
            if (k === 'text' && typeof v === 'string') {
              console.log('       [' + i + '][' + j + '].text:', JSON.stringify(v.substring(0, 60)));
            } else if (k === 'functionCall') {
              console.log('       [' + i + '][' + j + '].functionCall:', JSON.stringify({ name: v.name, args: v.args, id: v.id }));
            } else if (k === 'functionResponse') {
              console.log('       [' + i + '][' + j + '].functionResponse:', JSON.stringify({ id: v.id, name: v.name, response_type: typeof v.response, response_keys: v.response ? Object.keys(v.response) : 'null/undefined' }));
            } else if (k === 'inlineData') {
              console.log('       [' + i + '][' + j + '].inlineData:', JSON.stringify({ mimeType: v.mimeType, dataLen: v.data?.length }));
            } else {
              console.log('       [' + i + '][' + j + '].' + k + ':', JSON.stringify(v).substring(0, 100));
            }
          });
        });
      });
    }
    if (body.config) console.log('config:', JSON.stringify(body.config).substring(0, 120));
    if (body.generationConfig) console.log('generationConfig:', JSON.stringify(body.generationConfig).substring(0, 120));
  }
  console.log('========================================\n');
  return orig(opts);
};

// ----------- SIMULATE ASSISTANT FLOW -----------
console.log('\n>>> STEP 1: First request');
const firstContents = [
  { role: 'user', parts: [{ text: 'Tra cứu gói tập của tôi' }] }
];
const tools = [
  { functionDeclarations: [{ name: 'databaseQuery', description: 'Query DB', parameters: { type: 'object', properties: { intent: { type: 'string' } } } }] }
];

try {
  const r1 = await g.models.generateContent({
    model,
    contents: firstContents,
    config: { temperature: 0.1, tools },
  });

  console.log('>>> First request OK. Text:', (r1.text || '(no text)').substring(0, 60));

  const fcPart = r1?.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
  if (!fcPart) {
    console.log('No function call in response. End test.');
    process.exit(0);
  }

  const { name, args, id } = fcPart.functionCall;
  console.log('>>> Function call detected:', name, 'id:', id, 'args:', JSON.stringify(args));

  // Simulate result with realistic data
  const toolResult = {
    membership: {
      plan: 'VIP Diamond',
      startDate: '2025-01-15',
      endDate: '2026-01-15',
      status: 'active',
      remainingDays: 173,
    },
    payment: {
      lastPayment: '2025-12-01',
      amount: 12000000,
      method: 'chuyển khoản',
    },
  };

  // Build exactly like aiAssistantService does
  const fcContent = {
    role: 'model',
    parts: [{ functionCall: { name, args, id } }],
  };

  const frPart = createPartFromFunctionResponse(id, name, toolResult);
  console.log('\n>>> frPart (from createPartFromFunctionResponse):');
  console.log(JSON.stringify(frPart, null, 2).substring(0, 300));

  const frContent = {
    role: 'user',
    parts: [frPart],
  };

  console.log('\n>>> STEP 2: Second request with function response');

  const r2 = await g.models.generateContent({
    model,
    contents: [...firstContents, fcContent, frContent],
    config: { temperature: 0.1, tools },
  });

  console.log('>>> Second request OK. Text:', (r2.text || '(no text)').substring(0, 120));

} catch (err) {
  console.error('\n>>> ERROR:', err.message?.substring(0, 500));
}
