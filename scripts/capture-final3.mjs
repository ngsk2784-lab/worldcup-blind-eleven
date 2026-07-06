// 재작업 라운드3 재캡처 — S2 모바일/데스크탑, S4 데스크탑 3장만.
// 실행: node scripts/capture-final3.mjs [baseUrl]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.argv[2] || 'http://localhost:5190'
const OUT_DIR = 'docs/review/final3'
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

  await gotoFormation(dPage)
  await sleep(300)
  await capture(dPage, 's2-formation-desktop-1440')

  await fillXI(dPage)
  await dPage.evaluate(() => window.__gameStore.getState().confirmXI())
  await dPage.waitForSelector('.reveal-screen')
  await sleep(1900)
  await capture(dPage, 's4-reveal-desktop-1440')

  await desktop.close()

  // ---- 모바일 390 ----
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const mPage = await mobile.newPage()

  await gotoFormation(mPage)
  await sleep(300)
  await capture(mPage, 's2-formation-mobile-390')

  await mobile.close()
  await browser.close()
  console.log('전체 캡처 완료')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
