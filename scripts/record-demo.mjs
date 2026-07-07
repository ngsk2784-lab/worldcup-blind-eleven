// 해커톤 제출용 시연 영상 촬영 스크립트.
// 프로덕션(https://worldcupmanager.vercel.app) 대상으로 Playwright recordVideo(1920x1080)로
// 전체 플로우(S0 온보딩 -> S1 탐색/비교 -> S2 배치 -> S3 확정 -> S4 정체공개 -> S5 결과)를
// 사람이 플레이하듯 페이싱을 두고 촬영한다. window.__gameStore 훅은 프로덕션 빌드에 없으므로
// (DEV 전용) 전 구간 실제 UI 상호작용(hover/click/drag)만 사용한다.
//
// 실행: node scripts/record-demo.mjs [baseUrl]
// 출력: docs/submission/demo-video.webm (+ ffmpeg 있으면 demo-video.mp4 로 변환)
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

const BASE_URL = process.argv[2] || 'https://worldcupmanager.vercel.app'
const OUT_DIR = 'docs/submission'
const VIDEO_TMP_DIR = 'docs/submission/.video-tmp'
const WIDTH = 1920
const HEIGHT = 1080

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(VIDEO_TMP_DIR, { recursive: true })

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function log(msg) {
  console.log(`[record-demo] ${msg}`)
}

/** PointerSensor 기반 실제 마우스 드래그. steps/interval로 속도를 조절해 사람이 끄는 느낌을 낸다. */
async function mouseDrag(page, from, to, { steps = 14, interval = 22, preHoldMs = 250, postHoldMs = 250 } = {}) {
  await page.mouse.move(from.x, from.y)
  await sleep(preHoldMs)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps
    const y = from.y + ((to.y - from.y) * i) / steps
    await page.mouse.move(x, y)
    await sleep(interval)
  }
  await sleep(postHoldMs)
  await page.mouse.up()
}

async function centerOf(locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('요소를 찾을 수 없습니다 (boundingBox null)')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** 후보 트레이에서 특정 포지션그룹의 "아직 배치 안 된" 첫 후보(트레이가 자동 필터링). */
function firstCandidate(page, group) {
  return page.locator(`[data-player-id][data-position-group="${group}"]`).first()
}

/**
 * 후보를 슬롯으로 드래그 배치.
 * @param {'slow'|'rhythm'} pace
 */
async function placeCandidate(page, group, slotId, pace = 'rhythm') {
  const slot = page.locator(`[data-slot-id="${slotId}"]`)
  // 헤드리스 드래그가 드물게 threshold를 못 넘겨 실패할 수 있어(§디버깅으로 확인),
  // 실패 시 자연스럽게 다시 시도한다(영상엔 "다시 끄는" 정도로만 보여 위화감 없음).
  for (let attempt = 1; attempt <= 3; attempt++) {
    const candidate = firstCandidate(page, group)
    await candidate.scrollIntoViewIfNeeded().catch(() => {})
    await sleep(150) // 스크롤 정착 대기 — boundingBox를 스크롤 애니메이션 중간에 읽지 않도록
    const from = await centerOf(candidate)
    const to = await centerOf(slot)
    if (pace === 'slow') {
      await mouseDrag(page, from, to, { steps: 26, interval: 34, preHoldMs: 450, postHoldMs: 500 })
    } else {
      await mouseDrag(page, from, to, { steps: 12, interval: 16, preHoldMs: 150, postHoldMs: 220 })
    }
    const filled = await slot.getAttribute('data-slot-filled')
    if (filled === 'true') {
      log(`  배치 완료: ${group} -> ${slotId}${attempt > 1 ? ` (재시도 ${attempt}회차 성공)` : ''}`)
      return
    }
    log(`  재시도 필요: ${slotId} 배치 실패 (attempt ${attempt})`)
    await sleep(400)
  }
  log(`  경고: ${slotId} 배치 최종 실패 (3회 시도)`)
}

/** 일부러 그룹이 다른 슬롯으로 드롭 -> 거부 피드백(토스트/셰이크) 시연. 슬롯은 비워진 채 유지됨. */
async function wrongDrop(page, group, slotId) {
  const candidate = firstCandidate(page, group)
  const slot = page.locator(`[data-slot-id="${slotId}"]`)
  await candidate.scrollIntoViewIfNeeded().catch(() => {})
  await sleep(150) // 스크롤 정착 대기 (안 하면 화면 밖 좌표로 드래그가 시작되어 무효 드롭이 됨)
  const from = await centerOf(candidate)
  const to = await centerOf(slot)
  await mouseDrag(page, from, to, { steps: 20, interval: 28, preHoldMs: 350, postHoldMs: 300 })
  await sleep(1400) // 경고 토스트/셰이크 애니메이션 노출 시간
  log(`  의도적 오배치 시연: ${group} 카드를 ${slotId}(다른 그룹) 슬롯에 드롭 -> 거부됨`)
}

async function main() {
  log(`대상: ${BASE_URL}`)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: { dir: VIDEO_TMP_DIR, size: { width: WIDTH, height: HEIGHT } },
  })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`)
  })

  const t0 = Date.now()
  const mark = (label) => log(`  [t=${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`)

  // ==========================================================================
  // S0. 온보딩 — 카피 읽히는 시간 확보 -> 대회 선택 -> 시작
  // ==========================================================================
  mark('S0 온보딩 진입')
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await sleep(4200) // 카피("이름을 지웠습니다" 등) 읽힐 시간

  const chip2018 = page.getByRole('button', { name: /2018 러시아 월드컵/ })
  await chip2018.hover()
  await sleep(500)
  await chip2018.click()
  await sleep(1800) // 대회 선택 반영 확인

  const startBtn = page.getByRole('button', { name: /스카우팅 시작/ })
  await startBtn.hover()
  await sleep(600)
  await startBtn.click()
  await page.waitForSelector('text=후보 선수 풀')
  mark('S1 탐색 화면 진입')

  // ==========================================================================
  // S1. 카드 탐색 — 호버/클릭/상세보기 + 2장 비교 (사람이 훑어보듯 느긋하게)
  // ==========================================================================
  await sleep(2200)
  const cards = page.locator('button[aria-label*="상세 보기"]')

  // 그리드를 훑어보듯 카드 몇 장 위로 마우스만 지나가본다.
  await cards.nth(2).hover()
  await sleep(700)
  await cards.nth(7).hover()
  await sleep(700)
  await cards.nth(4).hover()
  await sleep(700)

  // 카드 1: 상세 보기
  await cards.nth(0).hover()
  await sleep(600)
  await cards.nth(0).click()
  await sleep(3000) // 스탯/스파이더차트 훑어보는 시간

  const addCompareBtn = page.getByRole('button', { name: /비교에 추가/ })
  await addCompareBtn.hover()
  await sleep(500)
  await addCompareBtn.click()
  await sleep(1300)

  // 카드 2: 상세 보기 + 비교 추가 -> 비교 오버레이 노출
  await cards.nth(5).hover()
  await sleep(700)
  await cards.nth(5).click()
  await sleep(2800)
  await addCompareBtn.hover()
  await sleep(500)
  await addCompareBtn.click()
  await sleep(4200) // 비교 오버레이(레이더/스탯 대조) 감상

  // 카드 3: 추가 브라우징(비교 없이)
  await cards.nth(11).hover()
  await sleep(700)
  await cards.nth(11).click()
  await sleep(2400)

  // 카드 4: 한 번 더 훑어보기
  await cards.nth(16).hover()
  await sleep(600)
  await cards.nth(16).click()
  await sleep(2400)

  // 카드 5: 마지막으로 한 번 더
  await cards.nth(20).hover()
  await sleep(600)
  await cards.nth(20).click()
  await sleep(2200)
  mark('S1 비교/상세 시연 완료')

  const toFormationBtn = page.getByRole('button', { name: /배치하러 가기/ })
  await toFormationBtn.hover()
  await sleep(600)
  await toFormationBtn.click()
  await page.waitForSelector('[data-slot-id="GK"]')
  mark('S2 배치 화면 진입')

  // ==========================================================================
  // S2. 11명 드래그 배치 — 처음 몇 명은 천천히, 중간에 오배치 1회, 나머지는 리드미컬하게
  // ==========================================================================
  await sleep(2600)

  await placeCandidate(page, 'GK', 'GK', 'slow')
  await sleep(1500)
  await placeCandidate(page, 'DEF', 'LB', 'slow')
  await sleep(1500)
  await placeCandidate(page, 'DEF', 'CB1', 'slow')
  await sleep(1300)

  // 의도적 오배치: FWD 카드를 DEF 슬롯(CB2)에 드롭 -> 거부 피드백
  await wrongDrop(page, 'FWD', 'CB2')
  await sleep(1500)

  await placeCandidate(page, 'DEF', 'CB2', 'rhythm')
  await sleep(1000)
  await placeCandidate(page, 'DEF', 'RB', 'rhythm')
  await sleep(1000)
  await placeCandidate(page, 'MID', 'CM1', 'rhythm')
  await sleep(1000)
  await placeCandidate(page, 'MID', 'CM2', 'rhythm')
  await sleep(1000)
  await placeCandidate(page, 'MID', 'CM3', 'rhythm')
  await sleep(1000)
  await placeCandidate(page, 'FWD', 'LW', 'rhythm')
  await sleep(1000)
  await placeCandidate(page, 'FWD', 'ST', 'rhythm')
  await sleep(1000)
  await placeCandidate(page, 'FWD', 'RW', 'rhythm')
  await sleep(3200)
  mark('S2 11/11 배치 완료')

  // ==========================================================================
  // S3. 확정 브레이크 모달 — 잠시 홀드 -> 확정
  // ==========================================================================
  const revealCta = page.getByRole('button', { name: /정체 공개/ })
  await revealCta.hover()
  await sleep(500)
  await revealCta.click()
  await page.waitForSelector('text=되돌릴 수 없습니다')
  await sleep(4200) // 익명 라인업 미리보기 홀드
  mark('S3 확정 모달 진입')

  const confirmBtn = page.getByRole('button', { name: /공개한다/ })
  await confirmBtn.hover()
  await sleep(400)
  await confirmBtn.click()
  await page.waitForSelector('.reveal-screen')
  mark('S4 정체 공개 진입 — 끊지 않고 전체 시퀀스 대기')

  // ==========================================================================
  // S4. 정체 공개 — 클라이맥스. 끊지 말고 전체 시퀀스 그대로 감상(스킵/연타 없음)
  // ==========================================================================
  const resultCta = page.getByRole('button', { name: /결과 보기/ })
  await resultCta.waitFor({ state: 'visible', timeout: 60000 })
  mark('S4 전체 카드 공개 완료 (CTA 노출)')
  await sleep(900)
  await resultCta.hover()
  await sleep(400)
  await resultCta.click()
  await page.waitForSelector('.result-screen')
  mark('S5 결과 화면 진입')

  // ==========================================================================
  // S5. 결과 — 점수 카운트업 완료까지 대기, 등급/최고픽 노출, 공유 카드
  // ==========================================================================
  await sleep(2400) // 점수 카운트업(1.1s) + 등급 스냅 애니메이션(delay 1.0s) 완료 대기
  await sleep(4200) // 최고의 픽/의외의 픽/라인업 보드/실제 성적 대조 감상

  const saveBtn = page.getByRole('button', { name: /결과 카드 저장/ })
  await saveBtn.hover()
  await sleep(500)
  await saveBtn.click()
  await sleep(2000) // "저장됨 ✓" 상태 노출
  await sleep(3000) // 마지막 홀드(엔딩 카드)
  mark('S5 결과/공유 카드 시연 완료')

  if (consoleErrors.length) {
    log(`촬영 중 콘솔/페이지 에러 ${consoleErrors.length}건 발견:`)
    consoleErrors.forEach((e) => log(`  - ${e}`))
  } else {
    log('촬영 중 콘솔/페이지 에러 없음')
  }

  await context.close()
  const videoPath = await page.video().path()
  await browser.close()

  const totalSec = (Date.now() - t0) / 1000
  log(`촬영 종료. 총 소요 ${totalSec.toFixed(1)}s`)

  // 임시 폴더에서 완성된 webm을 최종 경로로 이동.
  const finalWebm = path.join(OUT_DIR, 'demo-video.webm')
  renameSync(videoPath, finalWebm)
  rmSync(VIDEO_TMP_DIR, { recursive: true, force: true })
  log(`webm 저장: ${finalWebm}`)

  // ffmpeg 있으면 mp4(h264)로 변환.
  const finalMp4 = path.join(OUT_DIR, 'demo-video.mp4')
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    execSync(
      `ffmpeg -y -i "${finalWebm}" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart -an "${finalMp4}"`,
      { stdio: 'inherit' },
    )
    log(`mp4 변환 완료: ${finalMp4}`)
  } catch (err) {
    log(`ffmpeg 변환 실패 또는 미설치 — webm만 남김 (${err.message})`)
  }
}

main().catch((err) => {
  console.error('[record-demo] 촬영 중 예외:', err)
  process.exit(1)
})
