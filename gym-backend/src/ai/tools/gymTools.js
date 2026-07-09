import { toolRegistry } from '../services/toolRegistry.js'

// Backward-compatible handler references
export const getAvailablePlansHandler = async () => toolRegistry.runTool('getAvailablePlans', {}, {})
export const getMembershipInfoHandler = async ({ userId }) => toolRegistry.runTool('getMembershipInfo', {}, { userId })
export const createMembership = async ({ userId, planId }) => toolRegistry.runTool('createMembership', { planId }, { userId })
export const getCheckinStatsHandler = async ({ userId }) => toolRegistry.runTool('getCheckinStats', {}, { userId })
export const getUpcomingBookingsHandler = async ({ userId }) => toolRegistry.runTool('getUpcomingBookings', {}, { userId })
export const getAvailablePTsHandler = async (args) => toolRegistry.runTool('getAvailablePTs', args || {}, {})
export const getRecommendedProductsHandler = async (args) => toolRegistry.runTool('getRecommendedProducts', args || {}, {})
export const createBookingRequestHandler = async (args) => toolRegistry.runTool('createBookingRequest', args, {})
export const getSmartRecommendationsHandler = async ({ userId, goal, budget, frequency }) =>
  toolRegistry.runTool('getSmartRecommendations', { goal, budget, frequency }, { userId })
export const analyzeWorkoutHandler = async ({ userId, period = '30d' }) =>
  toolRegistry.runTool('analyzeWorkout', { period }, { userId })
export const generateWorkoutPlanHandler = async ({ userId, goal = 'general_fitness', frequency = 4, level = 'beginner' }) =>
  toolRegistry.runTool('generateWorkoutPlan', { goal, frequency, level }, { userId })

// Backward-compatible declarations — always live from registry
export const gymToolDeclarations = []

export const gymTools = {}

export const runGymTool = async (name, args, context) => {
  return toolRegistry.runTool(name, args, context)
}

// Initialize registry on first import
const init = async () => {
  await toolRegistry.scanModules()
  const allTools = toolRegistry.getAllTools()
  // Backfill gymTools
  for (const t of allTools) {
    gymTools[t.name] = t.handler
  }
  // Backfill declarations
  const decls = toolRegistry.getDeclarations()
  gymToolDeclarations.length = 0
  gymToolDeclarations.push(...decls)
}
init()
