// 기획서 PDF 미리보기 PNG 생성: docs/submission/blind-eleven-proposal.pdf 의 각 페이지를
// pdfjs-dist(+@napi-rs/canvas)로 래스터라이즈하여 docs/review/pdf-preview/page-NN.png 로 저장.
// PDF 페이지 수가 바뀌면 기존 잔여 파일(예: 이전엔 있었지만 지금은 없는 뒤쪽 페이지)을 먼저 정리한다.
// 실행: node scripts/build-proposal-pdf.mjs && node scripts/render-proposal-pdf-preview.mjs
import { createCanvas } from '@napi-rs/canvas'
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'

const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

const SRC_PDF = 'docs/submission/blind-eleven-proposal.pdf'
const OUT_DIR = 'docs/review/pdf-preview'
const SCALE = 2 // ~144dpi, 리뷰용으로 충분한 해상도

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

// 기존 PNG 전부 삭제 (페이지 수가 줄어들 때 오래된 뒤쪽 페이지 파일이 남는 것을 방지)
for (const f of readdirSync(OUT_DIR)) {
  if (/^page-\d+\.png$/.test(f)) unlinkSync(path.join(OUT_DIR, f))
}

const data = new Uint8Array(readFileSync(SRC_PDF))
const doc = await pdfjsLib.getDocument({ data }).promise
console.log(`총 페이지 수: ${doc.numPages}`)

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i)
  const viewport = page.getViewport({ scale: SCALE })
  const canvas = createCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  const buf = canvas.toBuffer('image/png')
  const outPath = path.join(OUT_DIR, `page-${String(i).padStart(2, '0')}.png`)
  writeFileSync(outPath, buf)
  console.log(`저장: ${outPath}`)
}

console.log('완료.')
