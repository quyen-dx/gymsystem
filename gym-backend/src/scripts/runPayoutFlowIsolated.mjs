const uri = new URL(process.env.MONGO_URI)
uri.pathname = '/gympro_payout_autotest'
process.env.PAYOUT_TEST_MONGO_URI = uri.toString()

await import('./testPayoutFlow.mjs')
