// db.js
import mongoose from 'mongoose';


const dropStaleIndexes = async (db) => {
  try {
    const paymentsIndexes = await db.collection('payments').indexes()
    const staleRefIdIndex = paymentsIndexes.find(
      (idx) => idx.name === 'referenceId_1' || (idx.key && idx.key.referenceId === 1),
    )
    if (staleRefIdIndex && staleRefIdIndex.unique) {
      await db.collection('payments').dropIndex(staleRefIdIndex.name || 'referenceId_1')
      console.log('✅ Dropped stale unique index referenceId_1 from payments collection')
    }
  } catch (idxError) {
    if (idxError.code !== 27 && idxError.codeName !== 'IndexNotFound') {
      console.warn('⚠️ Could not check/drop stale payment indexes:', idxError.message)
    }
  }
}

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ MongoDB Atlas connected: ${conn.connection.host}`);
        await dropStaleIndexes(conn.connection.db)
    } catch (error) {
        console.error(`❌ MongoDB error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;