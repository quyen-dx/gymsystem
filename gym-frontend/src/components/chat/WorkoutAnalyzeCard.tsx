import type { WorkoutAnalysisData, WorkoutPlanData } from '../../types/aichat/aichat'
import { useTranslation } from 'react-i18next'

interface AnalysisProps {
  data: WorkoutAnalysisData
  lang?: 'vi' | 'en'
}

interface PlanProps {
  data: WorkoutPlanData
  lang?: 'vi' | 'en'
}

const INTENSITY_COLOR = (score: number) =>
  score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'

function StatBadge({ label, value, unit = '', score }: { label: string; value: string | number; unit?: string; score?: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: score ? INTENSITY_COLOR(score) : 'inherit' }}>
        {value}{unit}
      </div>
    </div>
  )
}

export function WorkoutAnalyzeCard({ data, lang: propLang }: AnalysisProps) {
  const { i18n } = useTranslation()
  const lang = propLang || (i18n.language?.startsWith('en') ? 'en' : 'vi')

  return (
    <div className="smart-recommend-card" style={{ marginTop: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>📊</span>
        <span>{lang === 'en' ? 'Workout Analysis' : 'Phân tích tập luyện'}</span>
        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.5, marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 8 }}>
          {data.goalLabel}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
        <StatBadge label={lang === 'en' ? 'Workouts' : 'Buổi tập'} value={data.stats.totalWorkouts} score={Math.min(100, data.stats.totalWorkouts * 5)} />
        <StatBadge label={lang === 'en' ? 'Freq' : 'Tần suất'} value={data.stats.frequencyPerWeek} unit="/tuần" score={Math.min(100, data.stats.frequencyPerWeek * 20)} />
        <StatBadge label={lang === 'en' ? 'Streak' : 'Chuỗi'} value={data.stats.currentStreak} unit=" ngày" score={Math.min(100, data.stats.currentStreak * 15)} />
        <StatBadge label={lang === 'en' ? 'Longest' : 'Dài nhất'} value={data.stats.longestStreak} unit=" ngày" />
        <StatBadge label={lang === 'en' ? 'Avg min' : 'TB phút'} value={data.stats.avgDurationPerSession} />
        <StatBadge label={lang === 'en' ? 'Completion' : 'Hoàn thành'} value={data.stats.completionRate} unit="%" score={data.stats.completionRate} />
      </div>

      {data.stats.totalCalories > 0 && (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
          🔥 {lang === 'en' ? `~${data.stats.totalCalories} kcal total (${data.stats.avgCaloriesPerSession}/session)` : `~${data.stats.totalCalories} kcal tổng (${data.stats.avgCaloriesPerSession}/buổi)`}
        </div>
      )}

      {data.topWorkoutTypes?.length > 0 && (
        <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {data.topWorkoutTypes.map((t, i) => (
            <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.07)' }}>
              {t.label} · {t.count}
            </span>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#22c55e' }}>
          ✅ {lang === 'en' ? 'Strengths' : 'Điểm mạnh'}
        </div>
        {data.strengths.map((s, i) => (
          <div key={i} style={{ fontSize: 12, opacity: 0.85, marginBottom: 2, paddingLeft: 12 }}>
            · {s}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#f97316' }}>
          📌 {lang === 'en' ? 'Can improve' : 'Cần cải thiện'}
        </div>
        {data.improvements.map((imp, i) => (
          <div key={i} style={{ fontSize: 12, opacity: 0.85, marginBottom: 2, paddingLeft: 12 }}>
            · {imp}
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', fontSize: 12, lineHeight: 1.6 }}>
        💡 {data.tip}
      </div>
    </div>
  )
}

export function WorkoutPlanCard({ data, lang: propLang }: PlanProps) {
  const { i18n } = useTranslation()
  const lang = propLang || (i18n.language?.startsWith('en') ? 'en' : 'vi')

  return (
    <div className="smart-recommend-card" style={{ marginTop: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🏋️</span>
        <span>{lang === 'en' ? 'Workout Plan' : 'Giáo án tập luyện'}</span>
        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.5, marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 8 }}>
          {data.goalLabel} · {lang === 'en' ? `${data.frequency}/week` : `${data.frequency}/tuần`}
        </span>
      </div>

      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>
        {lang === 'en' ? `Level: ${data.level} · ${data.durationPerSession} min/session` : `Trình độ: ${data.level === 'beginner' ? 'Cơ bản' : 'Trung cấp'} · ${data.durationPerSession} phút/buổi`}
      </p>

      <div style={{ display: 'grid', gap: 10 }}>
        {data.weeklySchedule.map((day, di) => (
          <div key={di} className="ai-plan-row">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#60a5fa' }}>
              {day.day} · {day.focus}
            </div>
            {day.exercises.map((ex, ei) => (
              <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.85, padding: '2px 0', borderBottom: ei < day.exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span>{ex.name}</span>
                <span style={{ opacity: 0.6 }}>{ex.sets ? `${ex.sets}×${ex.reps}` : ex.reps}{ex.duration ? ` · ${ex.duration}ph` : ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>🍽️ {lang === 'en' ? 'Nutrition tip' : 'Gợi ý dinh dưỡng'}</div>
        <div style={{ opacity: 0.85 }}>{data.nutritionTip}</div>
      </div>

      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {data.tips.map((tip, i) => (
          <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
            💡 {tip}
          </span>
        ))}
      </div>
    </div>
  )
}
