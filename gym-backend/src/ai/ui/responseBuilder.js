import { all } from './cardRegistry.js'
import { detectActions } from './actionDetector.js'

export function buildRichResponse(functionName, args, toolResult, llmText) {
  const cards = []
  const suggestions = []
  const deeplinks = []

  for (const [, builder] of all()) {
    const card = builder(toolResult)
    if (card) {
      cards.push(card)
      if (card.deeplink) deeplinks.push(card.deeplink)
      if (card.actions) {
        for (const a of card.actions) {
          if (a.label) suggestions.push(a.label)
          if (a.path && !deeplinks.includes(a.path)) deeplinks.push(a.path)
        }
      }
    }
  }

  const actions = detectActions(toolResult, llmText)

  return {
    message: llmText,
    cards,
    suggestions: [...new Set(suggestions)].slice(0, 4),
    deeplinks: [...new Set(deeplinks)].slice(0, 3),
    actions,
  }
}
