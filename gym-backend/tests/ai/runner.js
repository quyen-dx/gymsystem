import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TEST_DIRS = [
  'cards', 'database', 'web', 'vision', 'vector',
  'memory', 'routing', 'streaming', 'regression',
]

const metrics = {
  total: 0, pass: 0, fail: 0, skip: 0,
  suites: {}, startTime: Date.now(),
}

async function runTestFile(filePath) {
  const relative = path.relative(__dirname, filePath).replace(/\\/g, '/')
  const suiteName = path.dirname(relative)

  try {
    await import('./' + path.relative(__dirname, filePath).replace(/\\/g, '/'))
    return { file: relative, ok: true }
  } catch (err) {
    console.error(`\n  FAIL ${relative}: ${err.message}`)
    return { file: relative, ok: false, error: err.message }
  }
}

async function main() {
  console.log('AI Evaluation Framework')
  console.log('='.repeat(60))
  console.log()

  const allFiles = []

  for (const dir of TEST_DIRS) {
    const dirPath = path.join(__dirname, dir)
    if (!fs.existsSync(dirPath)) continue
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.test.js'))
    for (const f of files) {
      allFiles.push({ dir, file: path.join(dirPath, f) })
    }
  }

  const suiteResults = []

  for (const { dir, file } of allFiles) {
    const relative = path.relative(__dirname, file).replace(/\\/g, '/')
    process.stdout.write(`  ${relative} `)
    const start = Date.now()
    const result = await runTestFile(file)
    const elapsed = Date.now() - start
    if (result.ok) {
      console.log(`✓ ${elapsed}ms`)
      suiteResults.push({ suite: dir, status: 'PASS', duration: elapsed })
    } else {
      console.log(`✗ ${elapsed}ms - ${result.error}`)
      suiteResults.push({ suite: dir, status: 'FAIL', duration: elapsed, error: result.error })
    }
  }

  const totalDuration = Date.now() - metrics.startTime
  const passed = suiteResults.filter(r => r.status === 'PASS').length
  const failed = suiteResults.filter(r => r.status === 'FAIL').length

  console.log()
  console.log('='.repeat(60))
  console.log(`Results: ${passed} passed, ${failed} failed, ${suiteResults.length} total`)
  console.log(`Duration: ${totalDuration}ms`)
  console.log()

  for (const r of suiteResults) {
    const icon = r.status === 'PASS' ? '✓' : '✗'
    console.log(`  ${icon} ${r.suite.padEnd(20)} ${r.duration}ms${r.error ? ' - ' + r.error : ''}`)
  }

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Runner error:', err.message)
  process.exit(1)
})
