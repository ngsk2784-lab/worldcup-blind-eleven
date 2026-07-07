/**
 * 세션별 익명 코드/카드 순서 셔플 유틸.
 *
 * 목적: "익명 코드 = 특정 선수" 암기 공략 방지. 선수 데이터/능력치는 절대 건드리지 않고,
 * 표시용 레이어(코드 문자열, 카드 나열 순서)만 세션마다 흔든다.
 *
 * - 시드는 세션 시작(대회 선택 후 스카우팅 시작 / 다시하기) 시 1회 생성.
 * - 같은 시드로 셔플하면 항상 같은 순열이 나온다(결정론적 PRNG) → 한 세션 내내 일관.
 * - 시드가 바뀌면 순열이 통째로 달라진다 → 세션 간 상이.
 */
import type { PlayerCard, PositionGroup } from '../types'

/** 세션 시드 생성. crypto 가용하면 그걸로, 아니면 Math.random 폴백. 0은 피한다(mulberry32가 0시드에서도 동작은 하지만 명시적으로 회피). */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return arr[0] || 1
  }
  return Math.floor(Math.random() * 0xffffffff) || 1
}

/** mulberry32 — 작고 빠른 결정론적 PRNG. 같은 seed -> 같은 난수열. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates, seed로 결정론적. 원본 배열은 변경하지 않음(복사본 반환). */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed)
  const result = arr.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export interface SessionPool {
  pool: PlayerCard[]
  /** playerId -> 표시용 익명 코드, 예: "#G01". 접두(G/D/M/F)는 positionGroup 첫 글자 고정, 번호만 세션마다 셔플. */
  codeMap: Record<string, string>
}

/**
 * 원본 pool(불변)을 받아 세션 시드로 카드 순서를 셔플하고, 포지션군별 익명 코드를 재배정한다.
 * - 카드 나열 순서: pool 전체를 한 번에 셔플(포지션군 필터로 걸러도 부분순서가 균일 랜덤이 되도록).
 * - 코드 배정: 셔플된 순서를 그대로 따라가며 포지션군별 카운터로 번호를 매긴다(#G01, #G02...).
 */
export function buildSessionPool(basePool: PlayerCard[], seed: number): SessionPool {
  const pool = seededShuffle(basePool, seed)
  const counters: Record<PositionGroup, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  const codeMap: Record<string, string> = {}
  for (const player of pool) {
    const group = player.positionGroup
    counters[group] += 1
    codeMap[player.id] = `#${group[0]}${String(counters[group]).padStart(2, '0')}`
  }
  return { pool, codeMap }
}
