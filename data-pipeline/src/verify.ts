/**
 * verify.ts — 파이프라인 산출물(src/data/players.<year>.json, meta.json) 스키마·sanity 검증.
 * npm run build:data 이후 실행. 실패 시 exit(1).
 *
 * 실행: `npm run verify -- 2022` (인자 없으면 존재하는 모든 tournament 파일 검사)
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PlayerCard, Meta, PositionGroup } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "src", "data");

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  [PASS] ${msg}`);
  } else {
    console.log(`  [FAIL] ${msg}`);
    failures++;
  }
}

async function verifyTournament(year: number): Promise<void> {
  const file = path.join(DATA_DIR, `players.${year}.json`);
  const cards = JSON.parse(await readFile(file, "utf-8")) as PlayerCard[];
  console.log(`\n=== ${year} (players.${year}.json, ${cards.length}명) ===`);

  // --- 스키마 무결성 ---
  let schemaBad = 0;
  const axisKeys = ["attack", "passing", "defending", "dribbling", "aerial", "activity"] as const;
  const scoringKeys = ["statExcellence", "achievement", "fameProxy"] as const;
  for (const c of cards) {
    if (!["GK", "DEF", "MID", "FWD"].includes(c.positionGroup)) schemaBad++;
    for (const k of axisKeys) {
      const v = c.spider[k];
      if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 100) schemaBad++;
    }
    for (const k of scoringKeys) {
      const v = c.scoring[k];
      if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 100) schemaBad++;
    }
    if (c.heatmap.cells.length !== c.heatmap.cols * c.heatmap.rows) schemaBad++;
    if (!c.reveal.realName || !c.reveal.country) schemaBad++;
    if (c.keyStats.length < 3) schemaBad++;
  }
  check(schemaBad === 0, `스키마 무결성(spider/scoring 0~100, heatmap 길이, reveal 필드) — 위반 ${schemaBad}건`);
  check(cards.every((c) => c.sampleMinutes >= 180), "전원 minMinutesThreshold(180분) 이상");
  check(cards.length >= 40 && cards.length <= 60, `큐레이션 인원 40~60명 범위 (실제 ${cards.length})`);

  const byGroup = (g: PositionGroup) => cards.filter((c) => c.positionGroup === g);
  for (const g of ["GK", "DEF", "MID", "FWD"] as PositionGroup[]) {
    check(byGroup(g).length >= 4, `${g} 최소 4명 이상 확보 (실제 ${byGroup(g).length}명)`);
  }

  // --- 축구 상식 sanity check ---
  const fwd = byGroup("FWD").sort((a, b) => b.spider.attack - a.spider.attack);
  console.log("  FWD attack축 상위 5명:");
  fwd.slice(0, 5).forEach((c, i) => console.log(`    ${i + 1}. ${c.reveal.realName} (${c.reveal.country}) attack=${c.spider.attack} stat=${c.scoring.statExcellence}`));

  if (year === 2022) {
    const messi = cards.find((c) => c.reveal.realName.includes("Messi"));
    const mbappe = cards.find((c) => c.reveal.realName.includes("Mbapp"));
    check(!!messi, "Messi가 큐레이션 풀에 포함됨");
    check(!!mbappe, "Mbappé가 큐레이션 풀에 포함됨");
    if (messi) {
      const rank = fwd.findIndex((c) => c.id === messi.id) + 1;
      check(messi.positionGroup === "FWD", `Messi positionGroup === FWD (실제 ${messi.positionGroup})`);
      check(messi.spider.attack >= 80, `Messi attack축 percentile >= 80 (실제 ${messi.spider.attack}, FWD 내 ${rank}/${fwd.length}위)`);
      check(messi.reveal.teamResult.furthestRound === "Winner", `Messi teamResult.furthestRound === Winner (실제 ${messi.reveal.teamResult.furthestRound})`);
    }
    if (mbappe) {
      const rank = fwd.findIndex((c) => c.id === mbappe.id) + 1;
      check(mbappe.spider.attack >= 80, `Mbappé attack축 percentile >= 80 (실제 ${mbappe.spider.attack}, FWD 내 ${rank}/${fwd.length}위)`);
      check(mbappe.reveal.teamResult.furthestRound === "Final", `Mbappé teamResult.furthestRound === Final (실제 ${mbappe.reveal.teamResult.furthestRound})`);
    }
  }

  const gk = byGroup("GK").sort((a, b) => b.scoring.statExcellence - a.scoring.statExcellence);
  console.log("  GK 전원 (선방/실점/출전분):");
  gk.forEach((c) => {
    const saves = c.keyStats.find((k) => k.label === "선방")?.value ?? -1;
    const conceded = c.keyStats.find((k) => k.label === "실점")?.value ?? -1;
    console.log(`    ${c.reveal.realName} (${c.reveal.country}) 선방=${saves} 실점=${conceded} 출전분=${c.sampleMinutes}`);
  });
  check(gk.every((c) => (c.keyStats.find((k) => k.label === "선방")?.value ?? -1) >= 0), "모든 GK의 선방 수치 >= 0 (음수/누락 없음)");
  check(gk.some((c) => (c.keyStats.find((k) => k.label === "선방")?.value ?? 0) > 0), "적어도 한 명 이상 GK가 선방 기록 보유");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).map(Number).filter((n) => n === 2022 || n === 2018) as (2018 | 2022)[];
  let years: (2018 | 2022)[] = args;
  if (years.length === 0) {
    const files = await readdir(DATA_DIR);
    years = files
      .filter((f) => /^players\.(2018|2022)\.json$/.test(f))
      .map((f) => Number(f.match(/players\.(\d{4})\.json/)![1]) as 2018 | 2022);
  }
  for (const y of years) {
    await verifyTournament(y);
  }

  const meta = JSON.parse(await readFile(path.join(DATA_DIR, "meta.json"), "utf-8")) as Meta;
  console.log(`\n=== meta.json ===`);
  check(meta.formations.length >= 1 && meta.formations.every((f) => f.slots.length === 11), "모든 formation이 11슬롯");
  check(meta.tournaments.length === years.length || meta.tournaments.length >= years.length, `meta.tournaments에 대회 정보 존재 (${meta.tournaments.map((t) => t.year).join(",")})`);

  console.log(`\n총 ${failures === 0 ? "PASS" : "FAIL"} (실패 ${failures}건)`);
  if (failures > 0) process.exit(1);
}

await main();
