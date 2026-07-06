// 재작업 라운드1 최종 재캡처 — S1/S2/S4/S5 데스크탑 1440 + S2/S4 모바일 390.
// 실행: node scripts/capture-final2.mjs [baseUrl]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.argv[2] || 'http://localhost:5190'
const OUT_DIR = 'docs/review/final2'
mkdirSync(OUT_DIR, { recursive: true })

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fillXI(page) {
  await page.evaluate(() => {
    const store = window.__gameStore
    const state = store.getState()
    Object.keys(state.slots).forEach((k) => state.remove(k))
    const slotIds = Object.keys(state.slots)
    const usedPlayerIds = new Set()
    for (const slotId of slotIds) {
      let group = 'DEF'
      if (slotId === 'GK') group = 'GK'
      else if (slotId.startsWith('CM') || slotId.startsWith('LM') || slotId.startsWith('RM')) group = 'MID'
      else if (slotId.startsWith('LW') || slotId.startsWith('RW') || slotId.startsWith('ST')) group = 'FWD'
      else group = 'DEF'
      const player = state.pool.find((p) => p.positionGroup === group && !usedPlayerIds.has(p.id))
      if (!player) continue
      usedPlayerIds.add(player.id)
      state.place(slotId, player.id)
    }
  })
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

  // ---- 데스크탑 1440 ----
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const dPage = await desktop.newPage()

  // S1 explore
  await dPage.goto(BASE_URL, { waitUntil: 'networkidle' })
  await dPage.getByRole('button', { name: /스카우팅 시작/ }).click()
  await dPage.waitForSelector('text=/\\d+\\/11/')
  await sleep(400)
  await capture(dPage, 's1-explore-desktop-1440')

  // S2 formation
  await dPage.getByRole('button', { name: /배치하러 가기/ }).click()
  await dPage.waitForSelector('[data-slot-id="GK"]')
  await sleep(300)
  await capture(dPage, 's2-formation-desktop-1440')

  // fill XI + confirm -> reveal
  await fillXI(dPage)
  await dPage.evaluate(() => window.__gameStore.getState().confirmXI())
  await dPage.waitForSelector('.reveal-screen')
  // 실명 등장(narrative) 단계까지 대기: enter300+hold500+flip600+impact300 = 1700ms
  await sleep(1900)
  await capture(dPage, 's4-reveal-desktop-1440')

  // 결과 화면까지 스킵
  await dPage.getByRole('button', { name: /건너뛰기/ }).click()
  await dPage.waitForSelector('.result-screen')
  await sleep(1500) // count-up + grade 애니메이션 정착 대기
  await capture(dPage, 's5-result-desktop-1440')

  await desktop.close()

  // ---- 모바일 390 ----
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const mPage = await mobile.newPage()

  await gotoFormation(mPage)
  await sleep(300)
  await capture(mPage, 's2-formation-mobile-390')

  await fillXI(mPage)
  await mPage.evaluate(() => window.__gameStore.getState().confirmXI())
  await mPage.waitForSelector('.reveal-screen')
  await sleep(1900)
  await capture(mPage, 's4-reveal-mobile-390')

  await mobile.close()
  await browser.close()
  console.log('전체 캡처 완료')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
