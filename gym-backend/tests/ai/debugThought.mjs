import { GoogleGenAI, createPartFromFunctionResponse } from '@google/genai';
import { readFileSync } from 'fs';

const envText = readFileSync('.env', 'utf-8');
function getEnv(name) {
  const re = new RegExp('^' + name + '=(.+)$', 'm');
  const m = envText.match(re);
  return m ? m[1].trim() : '';
}
const apiKey = (getEnv('GOOGLE_API_KEYS') || getEnv('GEMINI_API_KEYS')).split(',')[0].trim();
const model = getEnv('GOOGLE_MODELS').split(',')[0].trim() || 'gemini-3.6-flash';

console.log('Model:', model);
const g = new GoogleGenAI({ apiKey });

const tools = [{ functionDeclarations: [{ name: 'databaseQuery', description: 'Query DB', parameters: { type: 'object', properties: { intent: { type: 'string' } } } }] }];
const firstContents = [{ role: 'user', parts: [{ text: 'Check my membership' }] }];

// First request
const r1 = await g.models.generateContent({ model, contents: firstContents, config: { temperature: 0.1, tools } });
const fcPart = r1?.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
const { name, args, id } = fcPart.functionCall;

console.log('Model returned functionCall. Keys:', Object.keys(fcPart.functionCall).join(', '));
console.log();

const toolResult = { plan: 'VIP Diamond', status: 'active' };
const frPart = createPartFromFunctionResponse(id, name, toolResult);
const frContent = { role: 'user', parts: [frPart] };

// === APPROACH 1: Skip functionCall, just user msg + functionResponse ===
console.log('=== 1: Skip functionCall (only user msg + functionResponse) ===');
try {
  const r = await g.models.generateContent({ model, contents: [...firstContents, frContent], config: { temperature: 0.1 } });
  console.log('OK:', (r.text || 'no text').substring(0, 80));
} catch (e) {
  console.log('ERR:', e.message.substring(0, 200));
}

// === APPROACH 2: As text instead of functionResponse ===
console.log();
console.log('=== 2: function response as text (role=function / role=tool) ===');
try {
  const fc = { role: 'model', parts: [{ functionCall: { name, args, id } }] };
  const fr = { role: 'user', parts: [{ text: '[FUNCTION RESULT for ' + name + ']: ' + JSON.stringify(toolResult) }] };
  const r = await g.models.generateContent({ model, contents: [...firstContents, fc, fr], config: { temperature: 0.1 } });
  console.log('OK:', (r.text || 'no text').substring(0, 80));
} catch (e) {
  console.log('ERR:', e.message.substring(0, 200));
}

// === APPROACH 3: With thinkingConfig ===
console.log();
console.log('=== 3: First request with thinkingConfig.includeThoughts ===');
try {
  const r2 = await g.models.generateContent({
    model,
    contents: firstContents,
    config: { temperature: 0.1, tools, thinkingConfig: { includeThoughts: true } },
  });
  const fc2 = r2?.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
  if (fc2) {
    console.log('functionCall keys:', Object.keys(fc2.functionCall).join(', '));
    console.log('Has thought_signature:', fc2.functionCall.thought_signature !== undefined);
    if (fc2.functionCall.thought_signature !== undefined) {
      console.log('thought_signature type:', typeof fc2.functionCall.thought_signature);
    }
  } else {
    console.log('No function call (text response):', (r2.text||'').substring(0, 60));
  }
} catch (e) {
  console.log('ERR:', e.message.substring(0, 200));
}

// === APPROACH 4: With thinkingConfig + then second request with full functionCall ===
console.log();
console.log('=== 4: With thinkingConfig + full functionCall pass-through ===');
try {
  const r3 = await g.models.generateContent({
    model,
    contents: firstContents,
    config: { temperature: 0.1, tools, thinkingConfig: { includeThoughts: true } },
  });
  const fc3 = r3?.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
  if (fc3 && fc3.functionCall.thought_signature !== undefined) {
    console.log('Got thought_signature! Testing second request...');
    const { name: n, args: a, id: i } = fc3.functionCall;
    const fcContent = { role: 'model', parts: [{ functionCall: { ...fc3.functionCall } }] };
    const frContent = { role: 'user', parts: [createPartFromFunctionResponse(i, n, toolResult)] };
    try {
      const r4 = await g.models.generateContent({ model, contents: [...firstContents, fcContent, frContent], config: { temperature: 0.1, tools } });
      console.log('OK:', (r4.text || 'no text').substring(0, 80));
    } catch (e2) {
      console.log('Second request ERR:', e2.message.substring(0, 200));
    }
  } else {
    console.log('No thought_signature even with thinkingConfig. Keys:', fc3 ? Object.keys(fc3.functionCall) : 'no FC');
  }
} catch (e) {
  console.log('ERR:', e.message.substring(0, 200));
}

// === APPROACH 5: thought_signature as empty string ===
console.log();
console.log('=== 5: functionCall with thought_signature empty string ===');
try {
  const fc = { role: 'model', parts: [{ functionCall: { name, args, id, thought_signature: '' } }] };
  const fr = { role: 'user', parts: [frPart] };
  const r = await g.models.generateContent({ model, contents: [...firstContents, fc, fr], config: { temperature: 0.1, tools } });
  console.log('OK:', (r.text || 'no text').substring(0, 80));
} catch (e) {
  console.log('ERR:', e.message.substring(0, 200));
}
