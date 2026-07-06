/** 신뢰도 근사(출전시간 기반) 4단 도트. */
export function ConfidenceDots({ minutes }: { minutes: number }) {
  const level = minutes >= 540 ? 4 : minutes >= 360 ? 3 : minutes >= 180 ? 2 : 1
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }} role="img" aria-label={`신뢰도 ${level}/4`}>
      {Array.from({ length: 4 }, (_, i) => (
        <i
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i < level ? 'var(--data)' : 'var(--surface-line)',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  )
}
