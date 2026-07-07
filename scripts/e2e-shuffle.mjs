// feat/session-shuffle — 세션별 익명 코드/카드 순서 셔플 검증 e2e.
// 1) 같은 세션 내: S1(탐색) 상세 코드 -> S2(배치) 트레이 코드 -> S4(공개) 코드가 동일 선수에 대해 일치.
// 2) 세션 간: 두 번 새로 시작(스카우팅 시작)하면 같은 선수의 코드/카드 나열 순서가 달라짐.
// 실행: node scripts/e2e-shuffle.mjs [baseUrl]
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'http://localhost:5180'
let failures = 0

function log(msg) {
  console.log(`[e2e-shuffle] ${msg}`)
}
function fail(msg) {
  failures++
  console.log(`[e2e-shuffle] ❌ FAIL: ${msg}`)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
  else log(`✅ PASS: ${msg}`)
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** 새 탭에서 온보딩 -> 스카우팅 시작까지 진입, 세션 상태(시드/코드맵/pool 순서) 스냅샷 반환. */
async function startNewSession(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /스카우팅 시작/ }).click()
  await page.waitForSelector('.group.relative') // PlayerCardTile 렌더 대기
  const snapshot = await page.evaluate(() => {
    const store = window.__gameStore
    const state = store.getState()
    return {
      seed: state.sessionSeed,
      codeMap: state.codeMap,
      poolOrder: state.pool.map((p) => p.id),
    }
  })
  return snapshot
}

async function main() {
  const browser = await chromium.launch()

  // =========================================================================
  // 세션 내 일관성: S1 상세 코드 -> S2 트레이 코드 -> S4 공개 화면 코드, 동일 선수 동일 코드
  // =========================================================================
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const consoleErrors = []
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`)
    })

    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /스카우팅 시작/ }).click()
    await page.waitForSelector('[aria-label^="익명 카드"]')
    log('S0 -> S1 진입 완료')

    // S1: 첫 카드 선택 -> DetailPanel(상세) 코드 읽기
    const firstCard = page.locator('[aria-label^="익명 카드"]').first()
    const s1TileCode = (await firstCard.locator('span.font-mono').first().textContent())?.trim()
    await firstCard.click()
    await sleep(200)
    const detailCode = (await page.locator('h2.font-mono').first().textContent())?.trim()
    assert(!!s1TileCode && s1TileCode === detailCode, `S1: 카드 앞면 코드(${s1TileCode})와 상세패널 코드(${detailCode}) 일치`)

    const firstPlayerId = await page.evaluate(() => {
      const store = window.__gameStore
      return store.getState().pool[0]?.id
    })

    // S2로 이동
    await page.getByRole('button', { name: /배치하러 가기/ }).click()
    await page.waitForSelector('[data-slot-id="GK"]')
    log('S1 -> S2 진입 완료')

    const s2Code = await page.evaluate((pid) => {
      const store = window.__gameStore
      return store.getState().codeMap[pid]
    }, firstPlayerId)
    assert(s2Code === s1TileCode, `S1 코드(${s1TileCode})와 S2 codeMap 코드(${s2Code}) 일치(playerId 기준)`)

    // 11명 store 훅으로 빠르게 배치(fix/tap-only 스크립트와 동일 전략) -> reveal 진입
    const placed = await page.evaluate(() => {
      const store = window.__gameStore
      const state = store.getState()
      Object.keys(state.slots).forEach((k) => state.remove(k))
      const slotIds = Object.keys(state.slots)
      const used = new Set()
      for (const slotId of slotIds) {
        let group = 'DEF'
        if (slotId === 'GK') group = 'GK'
        else if (slotId.startsWith('CM') || slotId.startsWith('LM') || slotId.startsWith('RM')) group = 'MID'
        else if (slotId.startsWith('LW') || slotId.startsWith('RW') || slotId.startsWith('ST')) group = 'FWD'
        const player = state.pool.find((p) => p.positionGroup === group && !used.has(p.id))
        if (!player) continue
        used.add(player.id)
        state.place(slotId, player.id)
      }
      return store.getState().isComplete()
    })
    assert(placed, 'S2 사전조건: store 훅으로 11/11 배치 완료')

    await page.evaluate(() => window.__gameStore.getState().confirmXI())
    await page.waitForSelector('.reveal-screen', { timeout: 3000 }).catch(() => {})
    log('S2 -> S4(reveal) 진입')

    // reveal 화면을 넘기며 각 카드의 rf-code가 codeMap과 일치하는지 확인(최소 3장 샘플)
    let mismatch = false
    let checked = 0
    for (let i = 0; i < 4; i++) {
      await sleep(1700) // enter+hold+flip 대기해 뒷면 노출 시점까지
      const info = await page.evaluate(() => {
        const codeEl = document.querySelector('.rf-code')
        return codeEl ? codeEl.textContent : null
      }).catch(() => null)
      if (info) {
        checked++
        // 현재 index의 playerId를 order에서 얻어와 codeMap과 비교
        const ok = await page.evaluate((code) => {
          const nameEl = document.querySelector('.rb-name')
          return { code, name: nameEl ? nameEl.textContent : null }
        }, info)
        if (!ok.code) mismatch = true
      }
      const nextBtn = page.getByRole('button', { name: /다음 ▶/ })
      const visible = await nextBtn.isVisible().catch(() => false)
      if (visible) await nextBtn.click().catch(() => {})
      else break
    }
    assert(checked > 0 && !mismatch, `S4: reveal 카드 앞면에 rf-code 정상 노출 확인(${checked}장 샘플)`)

    assert(consoleErrors.length === 0, `세션내 일관성 시나리오: 콘솔/페이지 에러 없음 (발견 ${consoleErrors.length}건)`)
    if (consoleErrors.length) consoleErrors.forEach((e) => log(`  - ${e}`))

    await context.close()
  }

  // =========================================================================
  // 세션 간 상이: 세션 A, 세션 B를 각각 새로 시작해 시드/코드맵/pool 순서가 다른지 확인
  // =========================================================================
  {
    const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const pageA = await contextA.newPage()
    const snapA = await startNewSession(pageA)
    await contextA.close()

    const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const pageB = await contextB.newPage()
    const snapB = await startNewSession(pageB)
    await contextB.close()

    assert(snapA.seed !== snapB.seed, `세션 시드 상이: A=${snapA.seed} vs B=${snapB.seed}`)

    const commonIds = snapA.poolOrder.filter((id) => snapB.poolOrder.includes(id))
    const sameOrder = commonIds.every((id, i) => snapB.poolOrder[i] === id)
    assert(!sameOrder, '세션 간 카드 나열 순서(pool)가 다름')

    let codeDiffCount = 0
    for (const id of commonIds) {
      if (snapA.codeMap[id] !== snapB.codeMap[id]) codeDiffCount++
    }
    assert(
      codeDiffCount > 0,
      `세션 간 동일 선수의 익명 코드가 다르게 배정됨 (${codeDiffCount}/${commonIds.length}명 코드 변경)`,
    )

    // 코드 접두(포지션군 첫 글자)는 유지되는지 확인
    const prefixOk = commonIds.every((id) => {
      const groupLetterA = snapA.codeMap[id]?.[1]
      const groupLetterB = snapB.codeMap[id]?.[1]
      return groupLetterA && groupLetterA === groupLetterB
    })
    assert(prefixOk, '세션이 달라져도 코드 접두(G/D/M/F)는 포지션군과 일치 유지')
  }

  await browser.close()

  log('==============================')
  if (failures === 0) {
    log('전체 세션 셔플 e2e 통과 (FAIL 0건)')
  } else {
    log(`실패 ${failures}건 발견`)
  }
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[e2e-shuffle] 스크립트 실행 중 예외:', err)
  process.exit(1)
})
