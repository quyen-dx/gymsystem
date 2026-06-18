import type { BodyAnalysisResult } from '../../services/aiService'

interface Props {
  result: BodyAnalysisResult
  lang?: 'vi' | 'en'
}

const labels: Record<string, Record<string, string>> = {
  vi: {
    bodyType: 'Dáng người',
    estimatedCondition: 'Tình trạng ước lượng',
    strengths: 'Điểm mạnh',
    improvements: 'Điểm cần cải thiện',
    recommendedGoal: 'Mục tiêu đề xuất',
    explanation: 'Giải thích',
    title: 'Phân tích cơ thể',
  },
  en: {
    bodyType: 'Body Type',
    estimatedCondition: 'Estimated Condition',
    strengths: 'Strengths',
    improvements: 'Areas to Improve',
    recommendedGoal: 'Recommended Goal',
    explanation: 'Explanation',
    title: 'Body Analysis',
  },
}

export function BodyAnalysisCard({ result, lang = 'vi' }: Props) {
  const t = labels[lang] || labels.vi

  const cardStyle: React.CSSProperties = {
    background: 'var(--theme-card)',
    borderRadius: 16,
    border: '1px solid var(--theme-border)',
    padding: '18px 20px',
    display: 'grid',
    gap: 14,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--theme-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 4,
  }

  const valueStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--theme-text)',
    lineHeight: 1.5,
  }

  const chipStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 13,
    background: 'color-mix(in srgb, var(--theme-accent) 14%, transparent)',
    color: 'var(--theme-accent)',
    border: '1px solid color-mix(in srgb, var(--theme-accent) 28%, transparent)',
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--theme-text)' }}>{t.title}</div>

      <div>
        <div style={labelStyle}>{t.bodyType}</div>
        <div style={valueStyle}>{result.bodyType}</div>
      </div>

      <div>
        <div style={labelStyle}>{t.estimatedCondition}</div>
        <div style={valueStyle}>{result.estimatedCondition}</div>
      </div>

      <div>
        <div style={labelStyle}>{t.strengths}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {result.strengths.map((item, i) => (
            <span key={i} style={chipStyle}>{item}</span>
          ))}
        </div>
      </div>

      <div>
        <div style={labelStyle}>{t.improvements}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {result.improvements.map((item, i) => (
            <span key={i} style={{ ...chipStyle, background: 'color-mix(in srgb, #ff4d4f 10%, transparent)', color: '#ff4d4f', borderColor: 'color-mix(in srgb, #ff4d4f 24%, transparent)' }}>{item}</span>
          ))}
        </div>
      </div>

      <div>
        <div style={labelStyle}>{t.recommendedGoal}</div>
        <div style={{ ...valueStyle, fontWeight: 600 }}>{result.recommendedGoal}</div>
      </div>

      <div>
        <div style={labelStyle}>{t.explanation}</div>
        <div style={{ ...valueStyle, fontSize: 13, color: 'var(--theme-muted)' }}>{result.explanation}</div>
      </div>

      {result.recommendations && (
        <>
          <div style={{ height: 1, background: 'var(--theme-border)', margin: '4px 0' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)' }}>
            {lang === 'en' ? 'GymPro Recommendations' : 'Đề xuất từ GymPro'}
          </div>

          <div>
            <div style={labelStyle}>{lang === 'en' ? 'Goal' : 'Mục tiêu'}</div>
            <div style={valueStyle}>{result.recommendations.goal}</div>
          </div>

          {result.recommendations.recommendedPlan && (
            <div>
              <div style={labelStyle}>{lang === 'en' ? 'Best Plan' : 'Gói tập phù hợp nhất'}</div>
              <div style={{ ...valueStyle, fontWeight: 600 }}>{result.recommendations.recommendedPlan.name}</div>
              <div style={{ ...valueStyle, fontSize: 13, color: 'var(--theme-muted)', marginTop: 2 }}>{result.recommendations.recommendedPlan.reason}</div>
            </div>
          )}

          {result.recommendations.recommendedPT && (
            <div>
              <div style={labelStyle}>{lang === 'en' ? 'Best PT' : 'PT phù hợp nhất'}</div>
              <div style={{ ...valueStyle, fontWeight: 600 }}>{result.recommendations.recommendedPT.name}</div>
              <div style={{ ...valueStyle, fontSize: 13, color: 'var(--theme-muted)', marginTop: 2 }}>{result.recommendations.recommendedPT.reason}</div>
            </div>
          )}

          <div>
            <div style={labelStyle}>{lang === 'en' ? '4-12 Week Roadmap' : 'Lộ trình 4-12 tuần'}</div>
            <div style={{ ...valueStyle, fontSize: 13, color: 'var(--theme-muted)', lineHeight: 1.6 }}>{result.recommendations.roadmap}</div>
          </div>
        </>
      )}
    </div>
  )
}
