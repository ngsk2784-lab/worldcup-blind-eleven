// 재작업 라운드1 #8 — 부정경로(negative path) e2e.
// 실행: node scripts/e2e-negative.mjs [baseUrl]
// 결과: docs/review/e2e-negative-output.txt 로 리다이렉트해서 저장.
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'http://localhost:5180'
let failures = 0

function log(msg) {
  console.log(`[e2e-neg] ${msg}`)
}

function fail(msg) {
  failures++
  console.log(`[e2e-neg] ❌ FAIL: ${msg}`)
}

function assert(cond, msg) {
  if (!cond) fail(msg)
  else log(`✅ PASS: ${msg}`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** PointerSensor 기반 드래그(activationConstraint distance:4). 중간 스텝으로 실제 이동을 흉내낸다. */
async function mouseDrag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps
    const y = from.y + ((to.y - from.y) * i) / steps
    await page.mouse.move(x, y)
    await sleep(16)
  }
  await sleep(50)
  await page.mouse.up()
}

/** CDP 기반 실제 터치 드래그(TouchSensor activationConstraint delay:120ms, tolerance:5). */
async function touchDrag(client, from, to, steps = 10) {
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }],
  })
  // TouchSensor 활성화 지연(120ms)을 확실히 넘긴다.
  await sleep(180)
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps
    const y = from.y + ((to.y - from.y) * i) / steps
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    })
    await sleep(30)
  }
  await sleep(50)
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
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
  // 데스크탑 1440 컨텍스트: 테스트 1, 2, 3, 4, 6
  // =========================================================================
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`)
  })

  log(`대상: ${BASE_URL}`)
  await gotoFormation(page)
  log('S0 -> S1 -> S2 진입 완료')

  // --- 테스트 1: 잘못된 그룹 슬롯 드롭 거부 ---------------------------------
  {
    const gkCandidate = page.locator('[data-player-id][data-position-group="GK"]').first()
    const gkId = await gkCandidate.getAttribute('data-player-id')
    const defSlot = page.locator('[data-slot-id="LB"]')

    const srcBox = await gkCandidate.boundingBox()
    const dstBox = await defSlot.boundingBox()
    await mouseDrag(
      page,
      { x: srcBox.x + srcBox.width / 2, y: srcBox.y + srcBox.height / 2 },
      { x: dstBox.x + dstBox.width / 2, y: dstBox.y + dstBox.height / 2 },
    )
    await sleep(250)

    const toast = page.getByText(/슬롯엔.*만 배치할 수 있어요/)
    const toastVisible = await toast.isVisible().catch(() => false)
    assert(toastVisible, '테스트1: GK 카드를 DEF 슬롯에 드롭 -> 경고 토스트 노출')

    const slotFilled = await defSlot.getAttribute('data-slot-filled')
    assert(slotFilled === 'false', '테스트1: DEF 슬롯은 여전히 비어있음(거부됨)')

    const stillInTray = await page.locator(`[data-player-id="${gkId}"][data-position-group="GK"]`).count()
    assert(stillInTray === 1, '테스트1: GK 후보는 트레이에 그대로 남아있음(배치 안 됨)')
  }

  // --- 테스트 2: 11명 미만이면 확정 CTA disabled ----------------------------
  {
    const cta = page.getByRole('button', { name: /정체 공개/ })
    const disabled = await cta.isDisabled()
    assert(disabled, '테스트2: 0/11 상태에서 "정체 공개" CTA는 disabled')

    // GK 1명만 배치해도 여전히 disabled
    const gkCandidate = page.locator('[data-player-id][data-position-group="GK"]').first()
    const gkSlot = page.locator('[data-slot-id="GK"]')
    const srcBox = await gkCandidate.boundingBox()
    const dstBox = await gkSlot.boundingBox()
    await mouseDrag(
      page,
      { x: srcBox.x + srcBox.width / 2, y: srcBox.y + srcBox.height / 2 },
      { x: dstBox.x + dstBox.width / 2, y: dstBox.y + dstBox.height / 2 },
    )
    await sleep(250)
    const filled = await gkSlot.getAttribute('data-slot-filled')
    assert(filled === 'true', '테스트2 사전조건: GK 슬롯 정상 배치 확인')
    const stillDisabled = await cta.isDisabled()
    assert(stillDisabled, '테스트2: 1/11 상태에서도 "정체 공개" CTA는 여전히 disabled')
  }

  // --- 테스트 3: 같은 선수를 두 슬롯에 배치 -> 원슬롯 비워짐 (store 훅) -----
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
    // 다음 테스트에 영향 없도록 되돌림
    await page.evaluate(() => {
      const store = window.__gameStore
      store.getState().remove('CB1')
      store.getState().remove('CB2')
    })
  }

  // --- 테스트 4: 필드 밖 드롭은 no-op ----------------------------------------
  {
    const beforeCount = await page.locator('[data-slot-filled="true"]').count()
    const candidate = page.locator('[data-player-id][data-position-group="MID"]').first()
    const candId = await candidate.getAttribute('data-player-id')
    const srcBox = await candidate.boundingBox()
    // 헤더 로고 영역(드롭 불가 지대)으로 드롭
    await mouseDrag(page, { x: srcBox.x + srcBox.width / 2, y: srcBox.y + srcBox.height / 2 }, { x: 40, y: 20 })
    await sleep(250)
    const afterCount = await page.locator('[data-slot-filled="true"]').count()
    assert(afterCount === beforeCount, '테스트4: 필드 밖 드롭 후 배치된 슬롯 수 변화 없음(no-op)')
    const stillInTray = await page.locator(`[data-player-id="${candId}"]`).count()
    assert(stillInTray >= 1, '테스트4: 드래그한 카드는 제자리(트레이)로 복귀')
  }

  assert(consoleErrors.length === 0, `테스트4 부가: 콘솔/페이지 에러 없음 (발견: ${consoleErrors.length}건)`)
  if (consoleErrors.length) consoleErrors.forEach((e) => log(`  - ${e}`))

  // --- 테스트 6: reveal 중 건너뛰기/연타 -------------------------------------
  {
    // 11자리를 store 훅으로 빠르게 채운다(드래그 반복은 테스트1/2/4/5에서 이미 검증됨).
    const placed = await page.evaluate(() => {
      const store = window.__gameStore
      const state = store.getState()
      // 초기화
      Object.keys(state.slots).forEach((k) => state.remove(k))
      const slotIds = Object.keys(state.slots)
      const usedPlayerIds = new Set()
      let placedCount = 0
      // 각 슬롯 그룹에 맞는 미배치 선수를 채운다. 슬롯 그룹은 store에 직접 없으므로
      // window.__formationSlots 힌트가 없으면 GK/DEF/MID/FWD 접두 id 로 유추한다.
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
      // "다음 ▶" 연타(레이스 컨디션 유발 시도)
      const nextBtn = page.getByRole('button', { name: /다음 ▶/ })
      for (let i = 0; i < 15; i++) {
        const visible = await nextBtn.isVisible().catch(() => false)
        if (!visible) break
        await nextBtn.click({ timeout: 500 }).catch(() => {})
        await sleep(30)
      }
      await sleep(500)

      // "다음" 연타로 마지막 카드까지 도달하면 건너뛰기/다음 버튼은 사라지고
      // "결과 보기" CTA가 나타난다. 아직 컨트롤이 남아있으면(마지막 도달 전) 건너뛰기를
      // 더블클릭으로 연타하고, 이미 CTA 단계면 CTA를 더블클릭 연타해 중복 전환 여부를 검증한다.
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
  // 모바일 390 컨텍스트: 테스트 5 (실제 터치 드래그)
  // =========================================================================
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  const client = await mobileContext.newCDPSession(mobilePage)

  await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' })
  await mobilePage.getByRole('button', { name: /스카우팅 시작/ }).click()
  await mobilePage.getByRole('button', { name: /배치하러 가기/ }).click()
  await mobilePage.waitForSelector('[data-slot-id="GK"]')
  log('모바일 390: S0 -> S1 -> S2 진입 완료')

  {
    const gkCandidate = mobilePage.locator('[data-player-id][data-position-group="GK"]').first()
    const gkSlot = mobilePage.locator('[data-slot-id="GK"]')
    const srcBox = await gkCandidate.boundingBox()
    const dstBox = await gkSlot.boundingBox()
    await touchDrag(
      client,
      { x: srcBox.x + srcBox.width / 2, y: srcBox.y + srcBox.height / 2 },
      { x: dstBox.x + dstBox.width / 2, y: dstBox.y + dstBox.height / 2 },
    )
    await sleep(300)
    const filled = await gkSlot.getAttribute('data-slot-filled')
    assert(filled === 'true', '테스트5: 모바일 390 실제 터치(CDP) 드래그로 GK 슬롯 배치 성공')
    const countText = await mobilePage.locator('text=/\\d+\\/11/').first().textContent().catch(() => null)
    log(`  모바일 배치 카운트 표시: ${countText}`)
  }

  await mobileContext.close()
  await browser.close()

  log('==============================')
  if (failures === 0) {
    log('전체 부정경로 테스트 통과 (FAIL 0건)')
  } else {
    log(`실패 ${failures}건 발견`)
  }
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[e2e-neg] 스크립트 실행 중 예외:', err)
  process.exit(1)
})
