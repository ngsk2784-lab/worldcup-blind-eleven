/**
 * 국기 SVG — 전부 코드 생성(사진/외부 이미지 없음). 정체 공개(S4) 뒷면에서만 사용.
 * 커버되지 않는 국가는 이름 해시 기반 단색 + 이니셜로 폴백한다.
 */
interface FlagSpec {
  render: () => JSX.Element
}

const FLAGS: Record<string, FlagSpec> = {
  가나: {
    render: () => (
      <>
        <rect width="32" height="7.33" fill="#CE1126" />
        <rect y="7.33" width="32" height="7.33" fill="#FCD116" />
        <rect y="14.66" width="32" height="7.34" fill="#006B3F" />
        <polygon points="16,9 17.5,13.2 22,13.2 18.3,15.8 19.7,20 16,17.4 12.3,20 13.7,15.8 10,13.2 14.5,13.2" fill="#000" />
      </>
    ),
  },
  잉글랜드: {
    render: () => (
      <>
        <rect width="32" height="22" fill="#FFFFFF" />
        <rect x="13" width="6" height="22" fill="#CE1124" />
        <rect y="8" width="32" height="6" fill="#CE1124" />
      </>
    ),
  },
  세네갈: {
    render: () => (
      <>
        <rect width="10.7" height="22" fill="#00853F" />
        <rect x="10.7" width="10.7" height="22" fill="#FDEF42" />
        <rect x="21.3" width="10.7" height="22" fill="#E31B23" />
        <polygon points="16,7 17.2,10.6 21,10.6 17.9,12.8 19.1,16.4 16,14.2 12.9,16.4 14.1,12.8 11,10.6 14.8,10.6" fill="#00853F" />
      </>
    ),
  },
  아르헨티나: {
    render: () => (
      <>
        <rect width="32" height="22" fill="#FFFFFF" />
        <rect width="32" height="7.33" fill="#74ACDF" />
        <rect y="14.66" width="32" height="7.34" fill="#74ACDF" />
        <circle cx="16" cy="11" r="3" fill="#F6B40E" stroke="#85340A" strokeWidth="0.4" />
      </>
    ),
  },
  프랑스: {
    render: () => (
      <>
        <rect width="10.7" height="22" fill="#0055A4" />
        <rect x="10.7" width="10.7" height="22" fill="#FFFFFF" />
        <rect x="21.3" width="10.7" height="22" fill="#EF4135" />
      </>
    ),
  },
  미국: {
    render: () => (
      <>
        <rect width="32" height="22" fill="#B22234" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} y={i * 3.67 + 1.83} width="32" height="1.83" fill="#FFFFFF" />
        ))}
        <rect width="14" height="12" fill="#3C3B6E" />
      </>
    ),
  },
  브라질: {
    render: () => (
      <>
        <rect width="32" height="22" fill="#009739" />
        <polygon points="16,3 29,11 16,19 3,11" fill="#FEDD00" />
        <circle cx="16" cy="11" r="4.5" fill="#012169" />
      </>
    ),
  },
  독일: {
    render: () => (
      <>
        <rect width="32" height="7.33" fill="#000000" />
        <rect y="7.33" width="32" height="7.33" fill="#DD0000" />
        <rect y="14.66" width="32" height="7.34" fill="#FFCE00" />
      </>
    ),
  },
  크로아티아: {
    render: () => (
      <>
        <rect width="32" height="7.33" fill="#FF0000" />
        <rect y="7.33" width="32" height="7.33" fill="#FFFFFF" />
        <rect y="14.66" width="32" height="7.34" fill="#171796" />
      </>
    ),
  },
  스위스: {
    render: () => (
      <>
        <rect width="32" height="22" fill="#D52B1E" />
        <rect x="13.5" y="6" width="5" height="10" fill="#FFFFFF" />
        <rect x="10.5" y="9" width="11" height="4" fill="#FFFFFF" />
      </>
    ),
  },
  일본: {
    render: () => (
      <>
        <rect width="32" height="22" fill="#FFFFFF" />
        <circle cx="16" cy="11" r="6.2" fill="#BC002D" />
      </>
    ),
  },
  모로코: {
    render: () => (
      <>
        <rect width="32" height="22" fill="#C1272D" />
        <polygon
          points="16,7 17.2,10.6 21,10.6 17.9,12.8 19.1,16.4 16,14.2 12.9,16.4 14.1,12.8 11,10.6 14.8,10.6"
          fill="none"
          stroke="#006233"
          strokeWidth="1"
        />
      </>
    ),
  },
}

export function Flag({ country, width = 32, height = 22 }: { country: string; width?: number; height?: number }) {
  const spec = FLAGS[country]
  if (!spec) {
    // 폴백: 국가명 해시 기반 단색 + 이니셜(사진/이모지 대신 코드 생성)
    let hash = 0
    for (const ch of country) hash = (hash * 31 + ch.charCodeAt(0)) % 360
    return (
      <svg width={width} height={height} viewBox="0 0 32 22" role="img" aria-label={`${country} 국기`}>
        <rect width="32" height="22" fill={`hsl(${hash} 45% 30%)`} />
        <text x="16" y="15" fontSize="9" fill="#EAF1F7" textAnchor="middle" fontFamily="var(--font-mono)">
          {country.slice(0, 1)}
        </text>
      </svg>
    )
  }
  return (
    <svg width={width} height={height} viewBox="0 0 32 22" role="img" aria-label={`${country} 국기`} style={{ borderRadius: 2, overflow: 'hidden' }}>
      {spec.render()}
    </svg>
  )
}
