import mongoose from 'mongoose'
import { SYSTEM_SETTINGS_DEFAULTS } from '../config/systemSettingsDefaults.js'

const systemSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: 'global',
      unique: true,
      immutable: true,
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => SYSTEM_SETTINGS_DEFAULTS,
    },
  },
  {
    collection: 'system_settings',
    timestamps: true,
  },
)

export default mongoose.model('SystemSettings', systemSettingsSchema)

