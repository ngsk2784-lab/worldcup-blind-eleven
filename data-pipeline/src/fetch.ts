/**
 * fetch.ts — competition 43, season 106(2022)·3(2018)의
 * matches/events/lineups를 로컬 cache/(gitignore)로 다운로드.
 *
 * 실행: `npm run fetch -- 106 3` (인자 없으면 기본 106만).
 * 이후 aggregate.ts는 네트워크 호출 없이 이 cache/만 읽는다.
 *
 * 상세: docs/architecture.md §3-1
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.join(__dirname, "..", "cache");
const BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";

async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw lastErr;
}

/** URL을 가져와 cache/에 저장(있으면 캐시 사용), 파싱된 JSON 반환. */
export async function fetchJsonCached<T>(url: string, cacheRelPath: string): Promise<T> {
  const cachePath = path.join(CACHE_DIR, cacheRelPath);
  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, "utf-8")) as T;
  }
  await ensureDir(path.dirname(cachePath));
  const res = await fetchWithRetry(url);
  const text = await res.text();
  await writeFile(cachePath, text, "utf-8");
  return JSON.parse(text) as T;
}

export function matchesUrl(season: number): string {
  return `${BASE_URL}/matches/43/${season}.json`;
}
export function eventsUrl(matchId: number): string {
  return `${BASE_URL}/events/${matchId}.json`;
}
export function lineupsUrl(matchId: number): string {
  return `${BASE_URL}/lineups/${matchId}.json`;
}

interface MatchListEntry {
  match_id: number;
}

/** season(43/{season})의 matches + 모든 경기의 events/lineups를 cache/에 받아둔다. */
export async function fetchSeason(season: number): Promise<void> {
  console.log(`[fetch] season ${season}: matches 목록...`);
  const matches = await fetchJsonCached<MatchListEntry[]>(matchesUrl(season), `matches/${season}.json`);
  console.log(`[fetch] season ${season}: ${matches.length}경기 확인. events+lineups 다운로드...`);

  const CONCURRENCY = 6;
  let idx = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (idx < matches.length) {
      const i = idx++;
      const m = matches[i];
      await fetchJsonCached(eventsUrl(m.match_id), `events/${m.match_id}.json`);
      await fetchJsonCached(lineupsUrl(m.match_id), `lineups/${m.match_id}.json`);
      done++;
      if (done % 10 === 0 || done === matches.length) {
        console.log(`  [fetch] ${done}/${matches.length} 완료`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[fetch] season ${season} 완료 (cache: ${CACHE_DIR}).`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
  const seasons = args.length ? args : [106];
  for (const s of seasons) {
    await fetchSeason(s);
  }
}

await main();
