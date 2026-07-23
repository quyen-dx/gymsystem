import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const match = envContent.match(/^GEMINI_API_KEYS=(.+)/m);
if (!match) { console.error('No GEMINI_API_KEYS in .env'); process.exit(1); }
const apiKey = match[1].trim().split(',')[0].trim();

const g = new GoogleGenAI({ apiKey });

// Collect all models
console.log('Loading model catalog...');
const allModels = [];
for await (const m of g.models.list({})) {
  allModels.push(m);
}
console.log('Total models in catalog:', allModels.length);

// Filter for text chat models
const chatModels = allModels.filter(m => {
  const actions = m.supportedActions || [];
  return actions.includes('generateContent')
    && !m.name.includes('tts')
    && !m.name.includes('computer-use')
    && !m.name.includes('robotics')
    && !m.name.includes('native-audio')
    && !m.name.includes('live')
    && !m.name.includes('bidi')
    && !m.name.includes('omni');
});

console.log('Chat-capable candidates:', chatModels.length);
console.log();

const results = [];
for (const m of chatModels) {
  const modelId = m.name.replace(/^models\//, '');
  try {
    const result = await Promise.race([
      g.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
    ]);

    const text = result.text ? result.text.substring(0, 40) : '(empty)';
    results.push({ model: modelId, status: 'OK', text });
    console.log('OK  |', modelId, '|', text);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('404') || msg.includes('not found') || msg.includes('no longer')) {
      const errDetail = msg.includes('{') ? msg.split(/{/)[1]?.substring(0, 100).replace(/"/g,'') : 'not available';
      results.push({ model: modelId, status: '404', msg: errDetail });
      console.log('404 |', modelId, '|', errDetail);
    } else if (msg.includes('TIMEOUT')) {
      results.push({ model: modelId, status: 'TIMEOUT' });
      console.log('TMO |', modelId);
    } else if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE')) {
      results.push({ model: modelId, status: '429' });
      console.log('429 |', modelId);
    } else if (msg.includes('400')) {
      results.push({ model: modelId, status: '400', msg: msg.substring(0, 80) });
      console.log('400 |', modelId, '|', msg.substring(0, 80));
    } else if (msg.includes('403')) {
      results.push({ model: modelId, status: '403' });
      console.log('403 |', modelId);
    } else {
      results.push({ model: modelId, status: 'ERR', msg: msg.substring(0, 80) });
      console.log('ERR |', modelId, '|', msg.substring(0, 80));
    }
  }
}

console.log();
console.log('=== SUMMARY ===');
console.log('Working:', results.filter(r => r.status === 'OK').map(r => r.model).join(', '));
console.log('404 (not available to new users):', results.filter(r => r.status === '404').map(r => r.model).join(', '));
console.log('Other errors:', results.filter(r => r.status !== 'OK' && r.status !== '404').map(r => r.model + '=' + r.status).join(', '));
