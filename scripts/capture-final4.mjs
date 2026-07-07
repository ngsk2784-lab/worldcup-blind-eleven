// § 오너 실기기 플레이테스트 피드백(A: 탭-배치 모드, B: S2 모바일 레이아웃) 재캡처.
// 실행: node scripts/capture-final4.mjs [baseUrl]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.argv[2] || 'http://localhost:5199'
const OUT_DIR = 'docs/review/final4'
mkdirSync(OUT_DIR, { recursive: true })

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fillXI(page, count = 11) {
  await page.evaluate((count) => {
    const store = window.__gameStore
    const state = store.getState()
    Object.keys(state.slots).forEach((k) => state.remove(k))
    const slotIds = Object.keys(state.slots)
    const usedPlayerIds = new Set()
    let placed = 0
    for (const slotId of slotIds) {
      if (placed >= count) break
      let group = 'DEF'
      if (slotId === 'GK') group = 'GK'
      else if (slotId.startsWith('CM') || slotId.startsWith('LM') || slotId.startsWith('RM')) group = 'MID'
      else if (slotId.startsWith('LW') || slotId.startsWith('RW') || slotId.startsWith('ST')) group = 'FWD'
      else group = 'DEF'
      const player = state.pool.find((p) => p.positionGroup === group && !usedPlayerIds.has(p.id))
      if (!player) continue
      usedPlayerIds.add(player.id)
      state.place(slotId, player.id)
      placed++
    }
  }, count)
}

async function gotoFormation(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /스카우팅 시작/ }).click()
  await page.getByRole('button', { name: /배치하러 가기/ }).click()
  await page.waitForSelector('[data-slot-id="GK"]')
}

async function capture(page, name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: false })
  console.log(`captured ${name}`)
}

async function main() {
  const browser = await chromium.launch()

  // ---- 모바일 390: S2 헤더 + 선택모드 하이라이트 ----
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const mPage = await mobile.newPage()
  await gotoFormation(mPage)
  await sleep(300)
  await capture(mPage, 's2-formation-mobile-390-header')

  // 후보 카드 탭 -> 선택모드 + 슬롯 펄스 하이라이트
  const gkCandidate = mPage.locator('[data-player-id][data-position-group="GK"]').first()
  await gkCandidate.click()
  await sleep(400) // 펄스 애니메이션 프레임 캡처를 위해 대기
  await capture(mPage, 's2-formation-mobile-390-tapselect')

  // 11명 배치 완료 상태(미니카드 크기 확인용)
  await fillXI(mPage, 11)
  await sleep(300)
  await capture(mPage, 's2-formation-mobile-390-full11')

  // S1 상세패널(바텀시트) — "이 선수 배치하기" 버튼 확인
  await mPage.goto(BASE_URL, { waitUntil: 'networkidle' })
  await mPage.getByRole('button', { name: /스카우팅 시작/ }).click()
  await mPage.getByRole('button', { name: /익명 카드/ }).first().click()
  await sleep(300)
  await capture(mPage, 's1-detailpanel-mobile-390')

  await mobile.close()

  // ---- 데스크탑 1440: S2 회귀 확인 ----
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const dPage = await desktop.newPage()
  await gotoFormation(dPage)
  await sleep(300)
  await capture(dPage, 's2-formation-desktop-1440')

  await desktop.close()
  await browser.close()
  console.log('전체 캡처 완료')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
