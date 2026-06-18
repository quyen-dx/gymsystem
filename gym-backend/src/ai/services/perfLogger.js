const timers = new Map()

export const perfStart = (label) => {
  timers.set(label, Date.now())
}

export const perfEnd = (label) => {
  const start = timers.get(label)
  if (start === undefined) return
  timers.delete(label)
  const elapsed = Date.now() - start
  if (elapsed > 10) {
    console.log(`[PERF] ${label}: ${elapsed}ms`)
  }
  return elapsed
}

export const perfLog = (label, elapsedMs) => {
  if (elapsedMs > 10) {
    console.log(`[PERF] ${label}: ${elapsedMs}ms`)
  }
  return elapsedMs
}
