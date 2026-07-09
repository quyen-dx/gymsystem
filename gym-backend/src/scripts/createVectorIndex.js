import mongoose from 'mongoose'

const INDEX_NAME = 'vector_index'
const DB_NAME = 'gym'
const COLLECTION = 'vectordocuments'

const VECTOR_INDEX_JSON = {
  name: INDEX_NAME,
  type: 'vectorSearch',
  definition: {
    fields: [
      {
        type: 'vector',
        path: 'embedding',
        numDimensions: 768,
        similarity: 'cosine',
      },
      {
        type: 'filter',
        path: 'source',
      },
      {
        type: 'filter',
        path: 'language',
      },
    ],
  },
}

async function createVectorIndex() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB')

    const db = mongoose.connection.db
    const adminDb = db.admin()

    const existingIndexes = await adminDb.command({
      listSearchIndexes: `${DB_NAME}.${COLLECTION}`,
    })

    const hasIndex = existingIndexes?.indexes?.some((idx) => idx.name === INDEX_NAME)
    if (hasIndex) {
      console.log(`Vector Search index "${INDEX_NAME}" already exists on ${COLLECTION}`)
      await mongoose.disconnect()
      return
    }

    console.log(`Creating Vector Search index "${INDEX_NAME}" on ${DB_NAME}.${COLLECTION}...`)
    console.log('Index definition:', JSON.stringify(VECTOR_INDEX_JSON, null, 2))

    await db.collection(COLLECTION).createSearchIndex(VECTOR_INDEX_JSON)

    console.log(`Index "${INDEX_NAME}" created successfully!`)
    console.log('Note: It may take a few minutes for the index to be ready for queries.')
  } catch (err) {
    console.error('Failed to create index:', err.message)
    console.log('\nManual setup:')
    console.log('1. Open MongoDB Atlas UI')
    console.log('2. Go to Services > Atlas Search')
    console.log('3. Click "Create Search Index"')
    console.log('4. Select "Vector Search Index"')
    console.log('5. Configure:')
    console.log(`   - Database: ${DB_NAME}, Collection: ${COLLECTION}`)
    console.log(`   - Index name: ${INDEX_NAME}`)
    console.log('   - Use the following JSON definition:')
    console.log(JSON.stringify(VECTOR_INDEX_JSON, null, 2))
  } finally {
    await mongoose.disconnect()
  }
}

createVectorIndex()
