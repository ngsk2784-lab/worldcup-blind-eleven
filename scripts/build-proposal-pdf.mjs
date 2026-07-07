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

const bodyHtml = marked.parse(mdWithAbsImages)

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
  h1 {
    font-size: 30px;
    text-align: center;
    margin-top: 40vh;
    /* 표지: h1은 단독 첫 페이지 */
  }
  h2 {
    font-size: 21px;
    border-bottom: 3px solid #1a1a1a;
    padding-bottom: 6px;
    margin-top: 0;
    /* 각 대섹션(h2)은 항상 새 페이지에서 시작 */
    page-break-before: always;
  }
  /* 표지(h1) 바로 다음 h2는 부제목이므로 표지와 같은 페이지에 유지한다.
     (h1 + h2 는 h2 단독 규칙보다 specificity가 높아 우선 적용됨) */
  h1 + h2 {
    page-break-before: avoid;
    border-bottom: none;
    font-size: 18px;
    color: #555;
    margin-top: 16px;
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
