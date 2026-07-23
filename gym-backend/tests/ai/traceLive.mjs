import { readFileSync } from 'fs';
import { createPartFromFunctionResponse } from '@google/genai';
import { generateContent } from '../../src/ai/providers/chat/chatProvider.js';

async function main() {
  // This test mimics the EXACT aiAssistantService flow
  // Using the real databaseQuery tool declaration
  const tools = [{
    functionDeclarations: [{
      name: 'databaseQuery',
      description: 'Truy vấn dữ liệu từ database GymPro',
      parameters: {
        type: 'OBJECT',
        properties: {
          intent: {
            type: 'STRING',
            description: 'Intent: wallet_balance, membership_status, membership_expiry, upcoming_booking, unread_notifications',
            enum: ['wallet_balance', 'membership_status', 'membership_expiry', 'upcoming_booking', 'unread_notifications'],
          },
        },
        required: ['intent'],
      },
    }],
  }];

  // Message designed to trigger databaseQuery with membership_status
  const userMessage = 'Tra cứu trạng thái gói tập của tôi';

  const contents = [{ role: 'user', parts: [{ text: userMessage }] }];

  console.log('>>> FIRST REQUEST');
  const r1 = await generateContent({ contents, config: { temperature: 0.1, tools } });

  const fcPart = r1?.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
  if (!fcPart) {
    console.log('No function call triggered. Response:', (r1?.text || '').substring(0, 80));
    return;
  }

  const { name, args, id } = fcPart.functionCall;
  console.log('Function call:', name, 'args:', JSON.stringify(args));

  // Simulate a REALISTIC databaseQuery result (like membershipsStatus would return)
  const toolResult = {
    statusType: 'ACTIVE',
    currentMembership: {
      planName: 'VIP Diamond',
      endDate: '2026-12-31',
      remainingDays: 173,
      price: 2999000,
      features: ['Unlimited Gym Access', 'Free PT Sessions', 'Pool Access', 'Sauna'],
    },
    pendingRenewals: [],
  };

  // Build EXACTLY like aiAssistantService does
  const frPart = createPartFromFunctionResponse(id, name, toolResult);
  const functionResponseContent = {
    role: 'user',
    parts: [frPart],
  };

  console.log();
  console.log('=== FR PART (before serialization) ===');
  console.log(JSON.stringify(frPart, null, 2));

  console.log();
  console.log('>>> SECOND REQUEST (with functionResponse only, no functionCall)');

  try {
    const r2 = await generateContent({
      contents: [...contents, functionResponseContent],
      config: { temperature: 0.1, tools },
    });
    console.log('SUCCESS:', (r2?.text || '').substring(0, 150));
  } catch (err) {
    console.error('ERROR:', err.message?.substring(0, 500));
  }
}

main();
