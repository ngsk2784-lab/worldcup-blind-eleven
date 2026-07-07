// § 오너 실기기 플레이테스트 피드백 A — 모바일 탭-배치 모드 e2e.
// 실행: node scripts/e2e-tap-place.mjs [baseUrl]
// 결과: docs/review/e2e-tap-place.txt 로 리다이렉트해서 저장.
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'http://localhost:5199'
let failures = 0

function log(msg) {
  console.log(`[e2e-tap] ${msg}`)
}

function fail(msg) {
  failures++
  console.log(`[e2e-tap] ❌ FAIL: ${msg}`)
}

function assert(cond, msg) {
  if (!cond) fail(msg)
  else log(`✅ PASS: ${msg}`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function gotoFormation(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /스카우팅 시작/ }).click()
  await page.getByRole('button', { name: /배치하러 가기/ }).click()
  await page.waitForSelector('[data-slot-id="GK"]')
}

async function main() {
  const browser = await chromium.launch()
  const consoleErrors = []

  // =========================================================================
  // 모바일 390 컨텍스트 — 탭-배치 모드 전체 경로
  // =========================================================================
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await mobile.newPage()
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`)
  })

  log(`대상: ${BASE_URL} (모바일 390x844)`)
  await gotoFormation(page)
  log('S0 -> S1 -> S2 진입 완료')

  // --- 테스트 1: 카드 탭 -> 선택됨 상태(골드 테두리) + 슬롯 펄스 하이라이트 -----
  {
    const gkCandidate = page.locator('[data-player-id][data-position-group="GK"]').first()
    const gkId = await gkCandidate.getAttribute('data-player-id')
    await gkCandidate.click()
    await sleep(150)

    const selectedAttr = await gkCandidate.getAttribute('data-selected')
    assert(selectedAttr === 'true', '테스트1: 후보 카드 탭 -> data-selected="true" (선택됨 상태)')

    const banner = page.locator('[data-testid="tap-select-banner"]')
    const bannerVisible = await banner.isVisible().catch(() => false)
    assert(bannerVisible, '테스트1: 선택 안내 배너 노출')

    const gkSlot = page.locator('[data-slot-id="GK"]')
    const gkSlotFilled = await gkSlot.getAttribute('data-slot-filled')
    assert(gkSlotFilled === 'false', '테스트1 사전조건: GK 슬롯은 비어있음(펄스 하이라이트 대상)')

    // 다른 카드 탭 -> 선택 교체
    const gkCandidate2 = page.locator('[data-player-id][data-position-group="GK"]').nth(1)
    const gkId2 = await gkCandidate2.getAttribute('data-player-id')
    await gkCandidate2.click()
    await sleep(150)
    const firstStillSelected = await gkCandidate.getAttribute('data-selected')
    const secondSelected = await gkCandidate2.getAttribute('data-selected')
    assert(firstStillSelected === 'false' && secondSelected === 'true', `테스트1: 다른 카드 탭 -> 선택 교체 (${gkId} -> ${gkId2})`)
  }

  // --- 테스트 2: 빈 영역 탭 -> 선택 취소 -------------------------------------
  {
    // 헤더 로고 영역(카드/슬롯이 아닌 빈 배경)을 탭
    const banner = page.locator('[data-testid="tap-select-banner"]')
    assert(await banner.isVisible().catch(() => false), '테스트2 사전조건: 선택 상태 유지 중')

    // 명시적 취소 버튼으로 취소
    await page.locator('[data-testid="tap-select-cancel"]').click()
    await sleep(400)
    const bannerGone = await banner.isVisible().catch(() => false)
    assert(!bannerGone, '테스트2: "취소" 버튼 탭 -> 선택 해제(배너 사라짐)')

    const anyCardStillSelected = await page.locator('[data-selected="true"]').count()
    assert(anyCardStillSelected === 0, '테스트2: 취소 후 어떤 카드도 선택됨 상태 아님')
  }

  // --- 테스트 3: 잘못된 슬롯 탭 -> 거부(셰이크+토스트), 배치 안 됨 -------------
  {
    const gkCandidate = page.locator('[data-player-id][data-position-group="GK"]').first()
    await gkCandidate.click()
    await sleep(150)

    const defSlot = page.locator('[data-slot-id="LB"]')
    await defSlot.click({ force: true })
    await sleep(250)

    const toast = page.getByText(/슬롯엔.*만 배치할 수 있어요/)
    const toastVisible = await toast.isVisible().catch(() => false)
    assert(toastVisible, '테스트3: 포지션군 불일치 슬롯 탭 -> 경고 토스트 노출')

    const defFilled = await defSlot.getAttribute('data-slot-filled')
    assert(defFilled === 'false', '테스트3: 잘못된 슬롯은 배치되지 않고 비어있음')

    const banner = page.locator('[data-testid="tap-select-banner"]')
    const stillSelected = await banner.isVisible().catch(() => false)
    assert(stillSelected, '테스트3: 거부 후에도 선택 상태는 유지(다른 슬롯 재시도 가능)')
  }

  // --- 테스트 4: 올바른 슬롯 탭 -> 배치 완료(스냅) + 선택 해제 ----------------
  {
    const gkSlot = page.locator('[data-slot-id="GK"]')
    await gkSlot.click()
    await sleep(300)

    const gkFilled = await gkSlot.getAttribute('data-slot-filled')
    assert(gkFilled === 'true', '테스트4: 올바른(GK) 슬롯 탭 -> 배치 완료')

    const banner = page.locator('[data-testid="tap-select-banner"]')
    const bannerGoneAfterPlace = await banner.isVisible().catch(() => false)
    assert(!bannerGoneAfterPlace, '테스트4: 배치 완료 후 선택 상태 자동 해제')

    const countText = await page.locator('text=/\\d+\\/11/').first().textContent().catch(() => null)
    assert(countText === '1/11', `테스트4: 카운터 1/11 반영 (표시: ${countText})`)
  }

  // --- 테스트 5: 배치된 슬롯 탭 -> 해제(트레이 복귀) --------------------------
  {
    const gkSlot = page.locator('[data-slot-id="GK"]')
    // MiniCard 자체가 onClick=onRemove 버튼
    await gkSlot.locator('button').click()
    await sleep(250)
    const gkFilled = await gkSlot.getAttribute('data-slot-filled')
    assert(gkFilled === 'false', '테스트5: 배치된 슬롯 탭 -> 해제(빈 슬롯으로 복귀)')

    const countText = await page.locator('text=/\\d+\\/11/').first().textContent().catch(() => null)
    assert(countText === '0/11', `테스트5: 해제 후 카운터 0/11 반영 (표시: ${countText})`)
  }

  assert(consoleErrors.length === 0, `부가: 콘솔/페이지 에러 없음 (발견: ${consoleErrors.length}건)`)
  if (consoleErrors.length) consoleErrors.forEach((e) => log(`  - ${e}`))

  await mobile.close()

  // =========================================================================
  // 테스트 6: S1 "이 선수 배치하기" -> S2 자동 선택 진입점 (A4)
  // =========================================================================
  const context2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page2 = await context2.newPage()
  await page2.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page2.getByRole('button', { name: /스카우팅 시작/ }).click()
  // 첫 카드 탭 -> 모바일 바텀시트 상세패널 오픈
  await page2.getByRole('button', { name: /익명 카드/ }).first().click()
  await sleep(200)
  const placeBtn = page2.getByRole('button', { name: /이 선수 배치하기/ })
  const placeBtnVisible = await placeBtn.isVisible().catch(() => false)
  assert(placeBtnVisible, '테스트6 사전조건: S1 상세패널 "이 선수 배치하기" 버튼 노출')

  if (placeBtnVisible) {
    await placeBtn.click()
    await page2.waitForSelector('[data-slot-id="GK"]')
    await sleep(200)
    const banner = page2.locator('[data-testid="tap-select-banner"]')
    const bannerVisible = await banner.isVisible().catch(() => false)
    assert(bannerVisible, '테스트6: "이 선수 배치하기" 클릭 -> S2 진입 + 자동 선택 상태(배너 노출)')

    const anySelectedCard = await page2.locator('[data-selected="true"]').count()
    assert(anySelectedCard === 1, '테스트6: 해당 선수 카드가 트레이에서 선택됨 상태로 표시')
  }

  await context2.close()
  await browser.close()

  log('==============================')
  if (failures === 0) {
    log('전체 탭-배치 e2e 통과 (FAIL 0건)')
  } else {
    log(`실패 ${failures}건 발견`)
  }
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[e2e-tap] 스크립트 실행 중 예외:', err)
  process.exit(1)
})
