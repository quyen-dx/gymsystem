import { generateTestCases } from './testCaseGenerator.js'
import { evaluate } from './evaluator.js'
import { generateReport } from './reporter.js'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REPORT_PATH = resolve(__dirname, 'report.md')

async function main() {
  console.log('=== AI Evaluation Suite ===')
  console.log('')

  const startAll = performance.now()

  const testCases = generateTestCases()
  console.log(`Generated ${testCases.length} test cases`)
  console.log('')

  const byCategory = {}
  for (const tc of testCases) {
    const cat = tc.category || 'other'
    byCategory[cat] = (byCategory[cat] || 0) + 1
  }
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count} cases`)
  }
  console.log('')

  console.log('Running evaluation...')
  const results = await evaluate(testCases)

  const elapsed = ((performance.now() - startAll) / 1000).toFixed(1)
  console.log(`Evaluation complete in ${elapsed}s`)
  console.log('')

  const m = results.metrics
  console.log(`Intent Accuracy:  ${m.intentAccuracy}%`)
  console.log(`Tool Accuracy:    ${m.toolAccuracy}%`)
  console.log(`Subject Accuracy: ${m.subjectAccuracy}%`)
  console.log(`Action Accuracy:  ${m.actionAccuracy}%`)
  console.log(`DB Accuracy:      ${m.databaseAccuracy}%`)
  console.log(`Avg Latency:      ${m.avgLatencyMs}ms`)
  console.log(`Avg Tokens:       ${m.avgTokenUsage}`)
  console.log(`Errors:           ${results.errors}/${results.total}`)
  console.log('')

  const report = generateReport(results)
  writeFileSync(REPORT_PATH, report, 'utf8')
  console.log(`Report saved to ${REPORT_PATH}`)
}

main().catch((err) => {
  console.error('Evaluation failed:', err.message)
  process.exit(1)
})
