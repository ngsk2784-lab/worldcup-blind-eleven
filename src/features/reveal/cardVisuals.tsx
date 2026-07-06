/**
 * 카드 시각 요소 — 전부 코드 생성 SVG (사진/외부 이미지 없음).
 * WT-B의 `features/cards`와 시각적으로 동일한 스펙(§3.1)을 따르되,
 * 트리 충돌을 피하기 위해 reveal 피처 내부에 독립 구현했다.
 * 통합 시 WT-B의 공용 컴포넌트로 교체 가능(props 형태 유사하게 설계).
 */
import type { HeatmapGrid, PositionGroup, SpiderAxes } from '../../types';

export function positionColorVar(group: PositionGroup): string {
  switch (group) {
    case 'GK':
      return 'var(--pos-gk)';
    case 'DEF':
      return 'var(--pos-def)';
    case 'MID':
      return 'var(--pos-mid)';
    case 'FWD':
      return 'var(--pos-fwd)';
  }
}

export function positionColorHex(group: PositionGroup): string {
  return RAW_COLOR[group];
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function positionOverlay(group: PositionGroup, alpha = 0.12): string {
  return hexToRgba(RAW_COLOR[group], alpha);
}

const RAW_COLOR: Record<PositionGroup, string> = {
  GK: '#E8B04B',
  DEF: '#5B8DEF',
  MID: '#3FB98C',
  FWD: '#E5533C',
};

export function Silhouette({
  group,
  size = 56,
}: {
  group: PositionGroup;
  size?: number;
}) {
  const color = RAW_COLOR[group];
  const isGk = group === 'GK';
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" style={{ filter: 'drop-shadow(0 0 8px rgba(79,195,217,.18))' }}>
      <circle cx="27" cy="17" r="9.5" fill="#2A3641" stroke={color} strokeWidth="1" opacity={0.95} />
      <path d="M9 50c0-11 8-18 18-18s18 7 18 18z" fill="#2A3641" stroke={color} strokeWidth="1" />
      {isGk && (
        <>
          <circle cx="8" cy="36" r="4" fill="#2A3641" stroke={color} strokeWidth="1" />
          <circle cx="46" cy="36" r="4" fill="#2A3641" stroke={color} strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

const AXES: Array<{ key: keyof SpiderAxes; label: string }> = [
  { key: 'attack', label: '공격' },
  { key: 'passing', label: '패스' },
  { key: 'defending', label: '수비' },
  { key: 'dribbling', label: '드리블' },
  { key: 'aerial', label: '공중' },
  { key: 'activity', label: '활동량' },
];

export { AXES as SPIDER_AXES };

export function SpiderChart({
  values,
  size = 108,
  color = '#4FC3D9',
  faded = false,
}: {
  values: SpiderAxes;
  size?: number;
  color?: string;
  faded?: boolean;
}) {
  const vals = AXES.map((a) => values[a.key]);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 14;
  const N = 6;
  const pt = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const rings = [0.4, 0.7, 1].map((f, ri) => {
    let p = '';
    for (let i = 0; i < N; i++) {
      const [x, y] = pt(i, R * f);
      p += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return <path key={ri} d={p + 'Z'} fill="none" stroke="#33424F" strokeWidth={1} opacity={0.5} />;
  });
  const spokes = Array.from({ length: N }, (_, i) => {
    const [x, y] = pt(i, R);
    return (
      <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#33424F" strokeWidth={1} opacity={0.4} />
    );
  });
  let poly = '';
  const dots: [number, number][] = [];
  vals.forEach((v, i) => {
    const [x, y] = pt(i, (R * v) / 100);
    poly += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    dots.push([x, y]);
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} opacity={faded ? 0.35 : 1}>
      {rings}
      {spokes}
      <path d={poly + 'Z'} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.6} />
      {!faded &&
        dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.4} fill={color} />)}
    </svg>
  );
}

export function MiniHeatmap({ grid, color = '#4FC3D9' }: { grid: HeatmapGrid; color?: string }) {
  const { cols, rows, cells } = grid;
  const cw = 4;
  const ch = 4;
  const rects: JSX.Element[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = cells[y * cols + x] || 0;
      if (v < 6) continue;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * cw}
          y={y * ch}
          width={cw}
          height={ch}
          rx={1}
          fill={color}
          opacity={(v / 100) * 0.9 + 0.1}
        />,
      );
    }
  }
  return (
    <svg width={cols * cw} height={rows * ch} viewBox={`0 0 ${cols * cw} ${rows * ch}`}>
      <rect width={cols * cw} height={rows * ch} rx={3} fill="#0D141C" />
      {rects}
    </svg>
  );
}

export function ConfidenceDots({ minutes }: { minutes: number }) {
  // 4단계: <180 / <360 / <540 / 540+ (신뢰도 근사)
  const level = minutes >= 540 ? 4 : minutes >= 360 ? 3 : minutes >= 180 ? 2 : 1;
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
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
  );
}

interface FlagSpec {
  render: () => JSX.Element;
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
};

export function Flag({ country, width = 32, height = 22 }: { country: string; width?: number; height?: number }) {
  const spec = FLAGS[country];
  if (!spec) {
    // 폴백: 국가명 해시 기반 단색 + 이니셜(사진/이모지 대신 코드 생성)
    let hash = 0;
    for (const ch of country) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return (
      <svg width={width} height={height} viewBox="0 0 32 22">
        <rect width="32" height="22" fill={`hsl(${hash} 45% 30%)`} />
        <text x="16" y="15" fontSize="9" fill="#EAF1F7" textAnchor="middle" fontFamily="var(--font-mono)">
          {country.slice(0, 1)}
        </text>
      </svg>
    );
  }
  return (
    <svg width={width} height={height} viewBox="0 0 32 22" style={{ borderRadius: 2, overflow: 'hidden' }}>
      {spec.render()}
    </svg>
  );
}
