import Faq from './Faq.js'
import Policy from './Policy.js'
import Workout from './Workout.js'
import {
  syncOnSave,
  syncOnFindOneAndUpdate,
  syncOnDelete,
  syncExerciseSource,
} from '../ai/services/vectorSyncService.js'

export function setupVectorHooks() {
  const schemas = [
    { model: Faq, source: 'faq' },
    { model: Policy, source: 'policy' },
    { model: Workout, source: 'workout' },
  ]

  for (const { model, source } of schemas) {
    model.schema.post('save', async function () {
      try {
        if (source === 'workout') {
          await syncExerciseSource()
        } else {
          await syncOnSave(source, this)
        }
      } catch (err) {
        console.warn(`[VECTOR_HOOKS] ${source} post-save sync failed:`, err.message)
      }
    })

    if (source !== 'workout') {
      model.schema.post('findOneAndUpdate', async function (doc) {
        if (!doc) return
        try {
          await syncOnFindOneAndUpdate(source, doc)
        } catch (err) {
          console.warn(`[VECTOR_HOOKS] ${source} post-update sync failed:`, err.message)
        }
      })

      model.schema.post('findOneAndDelete', async function (doc) {
        if (!doc) return
        try {
          await syncOnDelete(source, String(doc._id))
        } catch (err) {
          console.warn(`[VECTOR_HOOKS] ${source} post-delete sync failed:`, err.message)
        }
      })
    } else {
      model.schema.post('findOneAndDelete', async function (doc) {
        if (!doc) return
        try {
          await syncExerciseSource()
        } catch (err) {
          console.warn('[VECTOR_HOOKS] Workout post-delete sync failed:', err.message)
        }
      })

      model.schema.post('deleteOne', async function () {
        try {
          await syncExerciseSource()
        } catch (err) {
          console.warn('[VECTOR_HOOKS] Workout deleteOne sync failed:', err.message)
        }
      })
    }
  }
}
