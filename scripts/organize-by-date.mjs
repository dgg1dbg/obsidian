import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"

const CONTENT_DIR = process.env.CONTENT_DIR ?? "content"
const DRY_RUN = process.env.DRY_RUN === "1"

// YYYY-MM-DD 형태의 date만 지원 (네 frontmatter 스타일)
function extractYearMonth(dateStr) {
  // "2026-02-22" -> ["2026", "02"]
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(dateStr).trim())
  if (!m) return null
  return [m[1], m[2]]
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function listMarkdownFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => path.join(dir, d.name))
}

function safeMove(src, dst) {
  ensureDir(path.dirname(dst))
  if (DRY_RUN) {
    console.log(`[dry] mv ${src} -> ${dst}`)
    return
  }
  fs.renameSync(src, dst)
  console.log(`mv ${src} -> ${dst}`)
}

const absContent = path.resolve(CONTENT_DIR)

// flat 가정: content 루트의 .md만 대상으로 (원하면 재귀로 바꿔줄 수 있음)
const files = listMarkdownFiles(absContent)

// 홈/폴더 index는 제외 (원하면 유지)
const exclude = new Set(["index.md"])
const targetFiles = files.filter((f) => !exclude.has(path.basename(f)))

for (const file of targetFiles) {
  const raw = fs.readFileSync(file, "utf8")
  const fm = matter(raw).data ?? {}

  // 네 문서: date: 2026-02-22
  const ym = extractYearMonth(fm.date)
  if (!ym) continue // date 없으면 루트에 남김

  const [year, month] = ym
  const baseName = path.basename(file)
  const dst = path.join(absContent, year, month, baseName)

  // 이미 정리된 파일이면 스킵
  if (path.normalize(file) === path.normalize(dst)) continue

  // 충돌 방지: 같은 파일명이 이미 있으면 _1, _2...
  let finalDst = dst
  let i = 1
  while (fs.existsSync(finalDst)) {
    const ext = path.extname(baseName)
    const name = path.basename(baseName, ext)
    finalDst = path.join(absContent, year, month, `${name}_${i}${ext}`)
    i++
  }

  safeMove(file, finalDst)
}

// 월 폴더에 보기 좋은 이름을 주고 싶으면 index.md 생성 (옵션)
if (!DRY_RUN) {
  // year/month 폴더들 순회해서 index.md 없으면 생성
  const years = fs.readdirSync(absContent, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
  for (const y of years) {
    const yearDir = path.join(absContent, y.name)
    const months = fs.readdirSync(yearDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{2}$/.test(d.name))
    for (const m of months) {
      const monthDir = path.join(yearDir, m.name)
      const idx = path.join(monthDir, "index.md")
      if (!fs.existsSync(idx)) {
        fs.writeFileSync(idx, `---\ntitle: "${y.name}-${m.name}"\n---\n`, "utf8")
      }
    }
  }
}
