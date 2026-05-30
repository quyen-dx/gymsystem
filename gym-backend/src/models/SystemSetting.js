import mongoose from 'mongoose'

const systemSettingSchema = new mongoose.Schema(
  {
    gymName: { type: String, default: 'GymPro', trim: true },
    slogan: { type: String, default: 'Nơi bạn vượt qua giới hạn', trim: true },
    slogans: {
      type: [mongoose.Schema.Types.Mixed],
      default: [
        { vi: 'Nơi bạn vượt qua giới hạn', en: 'Where you break your limits' },
        { vi: 'Chinh phục từng ngày', en: 'Conquer every day' },
      ],
      set: (values) => Array.isArray(values)
        ? values
          .map((item) => {
            if (typeof item === 'string') return { vi: item.trim(), en: '' }
            return { vi: String(item?.vi || '').trim(), en: String(item?.en || '').trim() }
          })
          .filter((item) => item.vi || item.en)
        : [],
    },
    logoUrl: { type: String, default: '', trim: true },
    bannerUrl: { type: String, default: '', trim: true },
    faviconUrl: { type: String, default: '', trim: true },
    pageBlocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
)

export default mongoose.model('SystemSetting', systemSettingSchema)
