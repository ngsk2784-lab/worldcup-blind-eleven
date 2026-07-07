// 기획서 PDF 빌드: docs/submission/proposal.md -> marked HTML 변환 -> 인쇄용 CSS 적용
// -> Playwright headless Chromium page.pdf()로 docs/submission/blind-eleven-proposal.pdf 생성.
// 실행: node scripts/build-proposal-pdf.mjs
import { chromium } from 'playwright'
import { marked } from 'marked'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SRC_MD = 'docs/submission/proposal.md'
const OUT_PDF = 'docs/submission/blind-eleven-proposal.pdf'

const md = readFileSync(SRC_MD, 'utf-8')

// 상대경로 이미지(../../docs/review/...)를 파일시스템 절대경로로 치환해 file:// 렌더링에서 깨지지 않게 한다.
const projectRoot = process.cwd()
const mdWithAbsImages = md.replace(/!\[([^\]]*)\]\((\.\.\/\.\.\/[^)]+)\)/g, (_m, alt, relPath) => {
  const cleaned = relPath.replace(/^(\.\.\/)+/, '')
  const abs = pathToFileURL(path.join(projectRoot, cleaned)).href
  return `![${alt}](${abs})`
})

// 표지(첫 페이지)에 쓸 값들은 proposal.md 본문에서 직접 추출한다(하드코딩 회피 -> 원본이 source of truth).
const titleMatch = md.match(/^#\s+(.+)$/m) // 제품명: 블라인드 일레븬(Blind XI)
const subtitleMatch = md.match(/^##\s+(.+)$/m) // 표지 대제목: 월드컵 감독 해커톤 기획서
const pitchSectionMd = md.split('## 1. 제품 개요')[1] ?? ''
const pitchMatch = pitchSectionMd.match(/\*\*([^*]+)\*\*/) // 한 줄 피치(볼드 문장, "## 1. 제품 개요" 도입부)
const deployMatch = md.match(/\*\*배포 URL\*\*:\s*(\S+)/)
const githubMatch = md.match(/\*\*GitHub 저장소\*\*:\s*(\S+)/)
const dateMatch = md.match(/\*기획서 작성:\s*([\d-]+)\*/)

if (!titleMatch || !subtitleMatch || !pitchMatch || !deployMatch || !githubMatch || !dateMatch) {
  throw new Error('표지 정보 추출 실패: proposal.md 구조가 변경되었는지 확인하세요.')
}

const coverHtml = `<div class="cover">
  <div class="cover-title">${subtitleMatch[1]}</div>
  <div class="cover-product">${titleMatch[1]}</div>
  <div class="cover-pitch">${pitchMatch[1]}</div>
  <div class="cover-footer">
    <div>배포 URL: ${deployMatch[1]}</div>
    <div>GitHub: ${githubMatch[1]}</div>
    <div>${dateMatch[1]}</div>
  </div>
</div>`

// 본문 렌더링은 원본 상단의 h1/제목(h2)/구분선을 제외한 "## 1. 제품 개요"부터 시작한다.
// (제목부는 위 coverHtml이 대체하므로 마크다운 원본은 손대지 않는다.)
const bodySectionStart = mdWithAbsImages.indexOf('## 1. 제품 개요')
const bodyMdOnly = bodySectionStart >= 0 ? mdWithAbsImages.slice(bodySectionStart) : mdWithAbsImages
const bodyHtml = marked.parse(bodyMdOnly)

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');

  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    color: #1a1a1a;
    line-height: 1.7;
    font-size: 13px;
    margin: 0;
    padding: 0;
  }
  h1, h2, h3, h4 {
    font-weight: 900;
    color: #111;
  }
  /* 표지: 커스텀 div(.cover)로 별도 렌더링. 단독 1페이지, 중앙 정렬. */
  .cover {
    height: 100vh;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    page-break-after: always;
  }
  .cover-title {
    font-size: 40px;
    font-weight: 900;
    color: #111;
    line-height: 1.5;
    margin-bottom: 30px;
  }
  .cover-product {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 12px;
  }
  .cover-pitch {
    font-size: 15px;
    color: #444;
    max-width: 480px;
  }
  .cover-footer {
    position: absolute;
    bottom: 34px;
    left: 0;
    width: 100%;
    text-align: center;
    font-size: 12px;
    color: #777;
  }
  .cover-footer div {
    margin: 3px 0;
  }
  h2 {
    font-size: 21px;
    border-bottom: 3px solid #1a1a1a;
    padding-bottom: 6px;
    margin-top: 0;
    /* 각 대섹션(h2)은 항상 새 페이지에서 시작 */
    page-break-before: always;
  }
  h3 {
    font-size: 16px;
    margin-top: 22px;
    color: #222;
  }
  h2, h3, h4 {
    page-break-after: avoid;
  }
  p, ul, ol {
    margin: 10px 0;
  }
  hr {
    display: none; /* 마크다운의 --- 구분선은 page-break로 대체되므로 시각적 라인은 생략 */
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 14px 0;
    font-size: 12px;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f0f0f0;
    font-weight: 700;
  }
  img {
    max-width: 100%;
    display: block;
    margin: 14px auto;
    border: 1px solid #ddd;
    border-radius: 4px;
    page-break-inside: avoid;
  }
  code {
    background: #f2f2f2;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 12px;
  }
  strong {
    font-weight: 700;
  }
  li {
    margin: 4px 0;
  }
  /* 카드형 블록(연속 리스트/이미지+텍스트 묶음)이 페이지 중간에서 끊기지 않도록
     h3 다음 첫 블록 요소들을 최대한 붙인다 */
  h3 + p, h3 + ul, h3 + ol {
    page-break-before: avoid;
  }
</style>
</head>
<body>
${coverHtml}
${bodyHtml}
</body>
</html>`

const tmpDir = mkdtempSync(path.join(tmpdir(), 'proposal-pdf-'))
const tmpHtmlPath = path.join(tmpDir, 'proposal.html')
writeFileSync(tmpHtmlPath, html, 'utf-8')

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(pathToFileURL(tmpHtmlPath).href, { waitUntil: 'networkidle' })
await page.pdf({
  path: OUT_PDF,
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
})
await browser.close()

console.log(`생성 완료: ${OUT_PDF}`)
