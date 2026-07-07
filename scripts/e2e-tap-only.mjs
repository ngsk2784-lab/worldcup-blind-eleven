// fix/tap-only — 드래그(@dnd-kit) 제거 후 클릭/탭 단일 배치 모드 부정경로 e2e.
// 기존 e2e-negative.mjs(드래그 기반) + e2e-tap-place.mjs 를 통합하고 클릭 기반으로 재작성.
// 실행: node scripts/e2e-tap-only.mjs [baseUrl]
// 결과: docs/review/e2e-tap-only.txt 로 리다이렉트해서 저장.
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'http://localhost:5180'
let failures = 0

function log(msg) {
  console.log(`[e2e-tap-only] ${msg}`)
}

function fail(msg) {
  failures++
  console.log(`[e2e-tap-only] ❌ FAIL: ${msg}`)
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
  // 데스크탑 1440 컨텍스트: 테스트 1(불일치 슬롯 거부), 2(11미만 CTA),
  // 3(중복 배치), 4(선택 취소), 6(reveal 연타)
  // =========================================================================
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`)
  })

  log(`대상: ${BASE_URL} (데스크탑 1440x900)`)
  await gotoFormation(page)
  log('S0 -> S1 -> S2 진입 완료')

  // --- 테스트 1: 불일치 슬롯 거부 — GK 카드 클릭 선택 -> DEF 슬롯 클릭 -> 거부 ---
  {
    const gkCandidate = page.locator('[data-player-id][data-position-group="GK"]').first()
    const gkId = await gkCandidate.getAttribute('data-player-id')
    await gkCandidate.click()
    await sleep(150)

    const selectedAttr = await gkCandidate.getAttribute('data-selected')
    assert(selectedAttr === 'true', '테스트1: GK 카드 클릭 -> 선택됨(data-selected="true")')

    const defSlot = page.locator('[data-slot-id="LB"]')
    await defSlot.click()
    await sleep(250)

    const toast = page.getByText(/슬롯엔.*만 배치할 수 있어요/)
    const toastVisible = await toast.isVisible().catch(() => false)
    assert(toastVisible, '테스트1: 포지션군 불일치 슬롯 클릭 -> 경고 토스트 노출')

    const slotFilled = await defSlot.getAttribute('data-slot-filled')
    assert(slotFilled === 'false', '테스트1: DEF 슬롯은 여전히 비어있음(거부됨)')

    const stillInTray = await page.locator(`[data-player-id="${gkId}"][data-position-group="GK"]`).count()
    assert(stillInTray === 1, '테스트1: GK 후보는 트레이에 그대로 남아있음(배치 안 됨)')

    const bannerAfterReject = page.locator('[data-testid="tap-select-banner"]')
    const stillSelected = await bannerAfterReject.isVisible().catch(() => false)
    assert(stillSelected, '테스트1: 거부 후에도 선택 상태는 유지(다른 슬롯 재시도 가능)')

    // 정리: 선택 취소
    await page.locator('[data-testid="tap-select-cancel"]').click()
    await sleep(150)
  }

  // --- 테스트 2: 11명 미만이면 확정 CTA disabled -------------------------------
  {
    const cta = page.getByRole('button', { name: /정체 공개/ })
    const disabled = await cta.isDisabled()
    assert(disabled, '테스트2: 0/11 상태에서 "정체 공개" CTA는 disabled')

    // GK 1명 클릭 선택 -> GK 슬롯 클릭 배치
    const gkCandidate = page.locator('[data-player-id][data-position-group="GK"]').first()
    await gkCandidate.click()
    await sleep(120)
    const gkSlot = page.locator('[data-slot-id="GK"]')
    await gkSlot.click()
    await sleep(250)

    const filled = await gkSlot.getAttribute('data-slot-filled')
    assert(filled === 'true', '테스트2 사전조건: 클릭-배치로 GK 슬롯 정상 배치 확인')
    const stillDisabled = await cta.isDisabled()
    assert(stillDisabled, '테스트2: 1/11 상태에서도 "정체 공개" CTA는 여전히 disabled')
  }

  // --- 테스트 3: 같은 선수를 두 슬롯에 배치 -> 원슬롯 비워짐 (store 훅) -------
  // (배치 로직 자체는 인터랙션 방식과 무관 — store.place 중복 배치 가드를 직접 검증)
  {
    const result = await page.evaluate(() => {
      const store = window.__gameStore
      if (!store) return { ok: false, reason: 'no __gameStore hook (DEV only)' }
      const state = store.getState()
      const defPlayer = state.pool.find((p) => p.positionGroup === 'DEF')
      if (!defPlayer) return { ok: false, reason: 'no DEF player in pool' }
      state.place('CB1', defPlayer.id)
      state.place('CB2', defPlayer.id)
      const after = store.getState().slots
      return { ok: true, cb1: after.CB1, cb2: after.CB2, playerId: defPlayer.id }
    })
    assert(result.ok, `테스트3 사전조건: store 훅 접근 가능 (${result.reason ?? 'ok'})`)
    if (result.ok) {
      assert(result.cb1 === null, '테스트3: 같은 선수를 CB2에 재배치하면 원래 슬롯(CB1)은 비워짐')
      assert(result.cb2 === result.playerId, '테스트3: 새 슬롯(CB2)에 정상 배치됨')
    }
    // 다음 테스트에 영향 없도록 되돌림(GK는 테스트2에서 배치한 상태 유지)
    await page.evaluate(() => {
      const store = window.__gameStore
      store.getState().remove('CB1')
      store.getState().remove('CB2')
    })
  }

  // --- 테스트 4: 선택 취소 (취소 버튼 + 배경 클릭 두 경로) ---------------------
  {
    const midCandidate = page.locator('[data-player-id][data-position-group="MID"]').first()
    await midCandidate.click()
    await sleep(150)
    const banner = page.locator('[data-testid="tap-select-banner"]')
    assert(await banner.isVisible().catch(() => false), '테스트4 사전조건: MID 카드 클릭 -> 선택 상태 진입')

    // 4a: 명시적 "취소" 버튼
    await page.locator('[data-testid="tap-select-cancel"]').click()
    await sleep(300)
    const bannerGoneAfterCancelBtn = await banner.isVisible().catch(() => false)
    assert(!bannerGoneAfterCancelBtn, '테스트4a: "취소" 버튼 클릭 -> 선택 해제(배너 사라짐)')
    const noneSelectedAfterCancelBtn = await page.locator('[data-selected="true"]').count()
    assert(noneSelectedAfterCancelBtn === 0, '테스트4a: 취소 후 어떤 카드도 선택됨 상태 아님')

    // 4b: 배경(빈 영역) 클릭으로도 취소 가능 — 후보 트레이 패널의 빈 여백(padding) 클릭
    await midCandidate.click()
    await sleep(150)
    assert(await banner.isVisible().catch(() => false), '테스트4b 사전조건: 다시 선택 상태 진입')
    const trayPanel = page.locator('[data-testid="candidate-tray-panel"]')
    const trayBox = await trayPanel.boundingBox()
    // 패널 자체(p-4 패딩 영역)를 클릭 — 자식 카드/탭 위가 아닌 패널 테두리 바로 안쪽.
    await page.mouse.click(trayBox.x + 6, trayBox.y + 6)
    await sleep(300)
    const bannerGoneAfterBgClick = await banner.isVisible().catch(() => false)
    assert(!bannerGoneAfterBgClick, '테스트4b: 배경(후보 트레이 패널 여백) 클릭 -> 선택 해제')
  }

  assert(consoleErrors.length === 0, `부가: 콘솔/페이지 에러 없음 (발견: ${consoleErrors.length}건)`)
  if (consoleErrors.length) consoleErrors.forEach((e) => log(`  - ${e}`))

  // --- 테스트 6: reveal 중 건너뛰기/연타 -------------------------------------
  {
    // 11자리를 store 훅으로 빠르게 채운다(클릭-배치 경로는 테스트1/2/4/5에서 이미 검증됨).
    const placed = await page.evaluate(() => {
      const store = window.__gameStore
      const state = store.getState()
      Object.keys(state.slots).forEach((k) => state.remove(k))
      const slotIds = Object.keys(state.slots)
      const usedPlayerIds = new Set()
      let placedCount = 0
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
        placedCount++
      }
      const complete = store.getState().isComplete()
      return { placedCount, complete }
    })
    assert(placed.complete, `테스트6 사전조건: store 훅으로 11/11 배치 완료 (${placed.placedCount}명)`)

    await page.evaluate(() => window.__gameStore.getState().confirmXI())
    await page.waitForSelector('.reveal-screen', { timeout: 3000 }).catch(() => {})
    const onReveal = (await page.locator('.reveal-screen').count()) > 0
    assert(onReveal, '테스트6 사전조건: Reveal(S4) 화면 진입')

    if (onReveal) {
      const nextBtn = page.getByRole('button', { name: /다음 ▶/ })
      for (let i = 0; i < 15; i++) {
        const visible = await nextBtn.isVisible().catch(() => false)
        if (!visible) break
        await nextBtn.click({ timeout: 500 }).catch(() => {})
        await sleep(30)
      }
      await sleep(500)

      const skipBtn = page.getByRole('button', { name: /건너뛰기/ })
      const ctaBtn = page.getByRole('button', { name: /결과 보기/ })
      const skipVisible = await skipBtn.isVisible().catch(() => false)
      const ctaVisible = await ctaBtn.isVisible().catch(() => false)
      if (skipVisible) {
        await Promise.all([skipBtn.click().catch(() => {}), skipBtn.click().catch(() => {})])
      } else if (ctaVisible) {
        await Promise.all([ctaBtn.click().catch(() => {}), ctaBtn.click().catch(() => {})])
      }
      await sleep(400)

      const onResultAfterSpam = (await page.locator('.result-screen').count()) > 0
      assert(onResultAfterSpam, '테스트6: 연타 후에도 정상적으로 Result(S5) 화면 도달(중복 전환/크래시 없음)')
      const resultScreenCount = await page.locator('.result-screen').count()
      assert(resultScreenCount === 1, '테스트6: Result 화면이 중복 렌더되지 않음')
    }
  }

  assert(consoleErrors.length === 0, `테스트6 부가: 연타 이후에도 콘솔/페이지 에러 없음 (누적 ${consoleErrors.length}건)`)
  if (consoleErrors.length) {
    log(`누적 콘솔/페이지 에러 ${consoleErrors.length}건:`)
    consoleErrors.forEach((e) => log(`  - ${e}`))
  } else {
    log('누적 콘솔/페이지 에러 없음')
  }

  await context.close()

  // =========================================================================
  // 모바일 390 컨텍스트: 테스트 5 — 모바일 탭 배치 전체 경로
  // =========================================================================
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const mobilePage = await mobile.newPage()
  const mobileConsoleErrors = []
  mobilePage.on('pageerror', (err) => mobileConsoleErrors.push(`pageerror: ${err.message}`))
  mobilePage.on('console', (msg) => {
    if (msg.type() === 'error') mobileConsoleErrors.push(`console.error: ${msg.text()}`)
  })

  await gotoFormation(mobilePage)
  log('모바일 390: S0 -> S1 -> S2 진입 완료')

  {
    const gkCandidate = mobilePage.locator('[data-player-id][data-position-group="GK"]').first()
    const gkId = await gkCandidate.getAttribute('data-player-id')
    await gkCandidate.tap()
    await sleep(150)

    const selectedAttr = await gkCandidate.getAttribute('data-selected')
    assert(selectedAttr === 'true', '테스트5: 모바일 390 — GK 카드 탭 -> 선택됨 상태')

    const banner = mobilePage.locator('[data-testid="tap-select-banner"]')
    assert(await banner.isVisible().catch(() => false), '테스트5: 선택 안내 배너 노출')

    const gkSlot = mobilePage.locator('[data-slot-id="GK"]')
    await gkSlot.tap()
    await sleep(300)

    const filled = await gkSlot.getAttribute('data-slot-filled')
    assert(filled === 'true', '테스트5: 모바일 390 탭-배치로 GK 슬롯 배치 성공')

    const bannerGone = await banner.isVisible().catch(() => false)
    assert(!bannerGone, '테스트5: 배치 완료 후 선택 상태 자동 해제')

    const countText = await mobilePage.locator('text=/\\d+\\/11/').first().textContent().catch(() => null)
    assert(countText === '1/11', `테스트5: 카운터 1/11 반영 (표시: ${countText})`)

    // 트레이 카드는 data-position-group을 함께 갖지만 슬롯 안착 MiniCard는 안 가짐 —
    // 두 속성을 함께 매칭해 "트레이 목록"만 특정한다.
    const stillInTrayBeforePlace = await mobilePage.locator(`[data-player-id="${gkId}"][data-position-group="GK"]`).count()
    assert(stillInTrayBeforePlace === 0, '테스트5: 배치된 후보는 트레이 목록에서 사라짐')

    // 배치된 슬롯 탭 -> 해제
    await gkSlot.locator('button').tap()
    await sleep(250)
    const gkFilledAfterRemove = await gkSlot.getAttribute('data-slot-filled')
    assert(gkFilledAfterRemove === 'false', '테스트5: 배치된 슬롯 탭 -> 해제(빈 슬롯으로 복귀)')
    const countTextAfterRemove = await mobilePage.locator('text=/\\d+\\/11/').first().textContent().catch(() => null)
    assert(countTextAfterRemove === '0/11', `테스트5: 해제 후 카운터 0/11 반영 (표시: ${countTextAfterRemove})`)
  }

  assert(mobileConsoleErrors.length === 0, `테스트5 부가: 모바일 콘솔/페이지 에러 없음 (발견: ${mobileConsoleErrors.length}건)`)
  if (mobileConsoleErrors.length) mobileConsoleErrors.forEach((e) => log(`  - ${e}`))

  await mobile.close()
  await browser.close()

  log('==============================')
  if (failures === 0) {
    log('전체 탭/클릭 전용 부정경로 e2e 통과 (FAIL 0건)')
  } else {
    log(`실패 ${failures}건 발견`)
  }
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[e2e-tap-only] 스크립트 실행 중 예외:', err)
  process.exit(1)
})
