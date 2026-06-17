import type { InBodyAnalysisResult } from '../../services/aiService'

interface Props {
  result: InBodyAnalysisResult
}

const metricLabels: Record<string, string> = {
  weight: 'Cân nặng',
  bodyFatPercent: '% Mỡ cơ thể',
  skeletalMuscle: 'Cơ xương',
  bmi: 'BMI',
  visceralFat: 'Mỡ nội tạng',
}

const metricUnits: Record<string, string> = {
  weight: 'kg',
  bodyFatPercent: '%',
  skeletalMuscle: 'kg',
  bmi: '',
  visceralFat: '',
}

export function InBodyAnalysisCard({ result }: Props) {
  if (result.unreadable) {
    return (
      <div style={{
        background: 'var(--theme-card)',
        borderRadius: 16,
        border: '1px solid var(--theme-border)',
        padding: '18px 20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-text)', marginBottom: 6 }}>
          Không đọc được phiếu InBody
        </div>
        <div style={{ fontSize: 13, color: 'var(--theme-muted)', lineHeight: 1.5 }}>
          {result.message || 'Vui lòng gửi ảnh rõ hơn, đảm bảo đủ ánh sáng và các chỉ số trong phiếu InBody hiện rõ.'}
        </div>
      </div>
    )
  }

  const metrics = result.metrics
  const hasMetrics = metrics && Object.values(metrics).some((v) => v !== null)

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

  const chipBase: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
  }

  const recommendColor = result.recommendation === 'giảm mỡ'
    ? { bg: 'color-mix(in srgb, #ff4d4f 10%, transparent)', color: '#ff4d4f', border: 'color-mix(in srgb, #ff4d4f 24%, transparent)' }
    : result.recommendation === 'tăng cơ'
      ? { bg: 'color-mix(in srgb, #52c41a 10%, transparent)', color: '#52c41a', border: 'color-mix(in srgb, #52c41a 24%, transparent)' }
      : { bg: 'color-mix(in srgb, #1677ff 10%, transparent)', color: '#1677ff', border: 'color-mix(in srgb, #1677ff 24%, transparent)' }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--theme-text)' }}>📊 Phân tích InBody</div>

      {hasMetrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: 10,
        }}>
          {Object.entries(metricLabels).map(([key, label]) => {
            const value = metrics?.[key as keyof typeof metrics]
            if (value === null || value === undefined) return null
            const unit = metricUnits[key] ? ` ${metricUnits[key]}` : ''
            return (
              <div key={key} style={{
                background: 'color-mix(in srgb, var(--theme-accent) 6%, transparent)',
                borderRadius: 12,
                padding: '10px 12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: 'var(--theme-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-text)' }}>
                  {value}{unit}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {result.interpretation && (
        <div>
          <div style={labelStyle}>Giải thích</div>
          <div style={valueStyle}>{result.interpretation}</div>
        </div>
      )}

      {result.assessment && (
        <div>
          <div style={labelStyle}>Đánh giá</div>
          <div style={valueStyle}>{result.assessment}</div>
        </div>
      )}

      {result.recommendation && (
        <div>
          <div style={labelStyle}>Đề xuất</div>
          <span style={{
            ...chipBase,
            background: recommendColor.bg,
            color: recommendColor.color,
            border: `1px solid ${recommendColor.border}`,
          }}>
            {result.recommendation}
          </span>
        </div>
      )}

      {result.explanation && (
        <div>
          <div style={labelStyle}>Chi tiết</div>
          <div style={{ ...valueStyle, fontSize: 13, color: 'var(--theme-muted)' }}>{result.explanation}</div>
        </div>
      )}

      {result.recommendations && (
        <>
          <div style={{ height: 1, background: 'var(--theme-border)', margin: '4px 0' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)' }}>Đề xuất từ GymPro</div>

          <div>
            <div style={labelStyle}>Mục tiêu</div>
            <div style={valueStyle}>{result.recommendations.goal}</div>
          </div>

          {result.recommendations.recommendedPlan && (
            <div>
              <div style={labelStyle}>Gói tập phù hợp nhất</div>
              <div style={{ ...valueStyle, fontWeight: 600 }}>{result.recommendations.recommendedPlan.name}</div>
              <div style={{ ...valueStyle, fontSize: 13, color: 'var(--theme-muted)', marginTop: 2 }}>{result.recommendations.recommendedPlan.reason}</div>
            </div>
          )}

          {result.recommendations.recommendedPT && (
            <div>
              <div style={labelStyle}>PT phù hợp nhất</div>
              <div style={{ ...valueStyle, fontWeight: 600 }}>{result.recommendations.recommendedPT.name}</div>
              <div style={{ ...valueStyle, fontSize: 13, color: 'var(--theme-muted)', marginTop: 2 }}>{result.recommendations.recommendedPT.reason}</div>
            </div>
          )}

          <div>
            <div style={labelStyle}>Lộ trình 4-12 tuần</div>
            <div style={{ ...valueStyle, fontSize: 13, color: 'var(--theme-muted)', lineHeight: 1.6 }}>{result.recommendations.roadmap}</div>
          </div>
        </>
      )}
    </div>
  )
}
