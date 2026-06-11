import type { ChartPoint } from '../utils/storage'

interface ConsistencyGraphProps {
  data: ChartPoint[]
  showYouVsYou?: boolean
}

export default function ConsistencyGraph({ data, showYouVsYou = false }: ConsistencyGraphProps) {
  const maxVal = 100
  const chartHeight = 120
  const barWidth = 28
  const gap = 8

  const getBarColor = (value: number) => {
    if (value >= 70) return '#10B981'
    if (value >= 40) return '#F59E0B'
    return '#EF4444'
  }

  const avg7Day = data.length > 0 ? Math.round(data.reduce((s, p) => s + p.value, 0) / data.length) : 0

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Y-axis labels */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: chartHeight,
            paddingBottom: 2,
          }}
        >
          {[100, 75, 50, 25, 0].map((v) => (
            <span key={v} style={{ fontSize: 10, color: '#6060A0', lineHeight: 1 }}>
              {v}
            </span>
          ))}
        </div>

        {/* Bars */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((v) => (
            <div
              key={v}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${(v / maxVal) * chartHeight}px`,
                height: 1,
                background: '#1E1E35',
              }}
            />
          ))}

          {/* You vs You ideal overlay */}
          {showYouVsYou && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: chartHeight,
                height: 2,
                background: '#7C3AED',
                opacity: 0.5,
              }}
            />
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', height: chartHeight, gap: gap, position: 'relative', zIndex: 1 }}>
            {data.map((point) => {
              const barH = Math.max(4, (point.value / maxVal) * chartHeight)
              const barColor = getBarColor(point.value)
              return (
                <div
                  key={point.date}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: barH,
                      background: barColor,
                      borderRadius: '3px 3px 0 0',
                      maxWidth: barWidth,
                      position: 'relative',
                      transition: 'height 0.4s ease',
                    }}
                  >
                    {showYouVsYou && point.value < 100 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: `${((100 - point.value) / 100) * chartHeight}px`,
                          background: '#7C3AED22',
                          transform: `translateY(-${((100 - point.value) / 100) * chartHeight}px)`,
                          borderRadius: '3px 3px 0 0',
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* X labels */}
      <div style={{ display: 'flex', gap: gap, marginTop: 6, paddingLeft: 28 }}>
        {data.map((point) => (
          <div key={point.date} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 10, color: '#6060A0' }}>{point.label}</span>
          </div>
        ))}
      </div>

      {/* Gap card for You vs You mode */}
      {showYouVsYou && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: '#13132A',
            borderRadius: 10,
            border: '1px solid #1E1E35',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, color: '#A0A0C0' }}>7-day average</span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: getBarColor(avg7Day),
            }}
          >
            {avg7Day}%
          </span>
        </div>
      )}
    </div>
  )
}
