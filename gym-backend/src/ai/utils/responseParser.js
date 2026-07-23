export function getFirstPart(response) {
  return response?.candidates?.[0]?.content?.parts?.[0]
}

export function hasFunctionCall(part) {
  return !!part?.functionCall
}

export function extractText(response) {
  return response?.candidates?.[0]?.content?.parts?.[0]?.text || ''
}
