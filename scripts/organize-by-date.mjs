import fs from "node:fs"
import path from "node:path"

const CONTENT_DIR = process.env.CONTENT_DIR ?? "content"
const DRY_RUN = process.env.DRY_RUN === "1"

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function listMarkdownFilesFlat(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => path.join(dir, d.name))
}

// frontmatter에서 date: 값을 단순 추출
// 지원 예시:
// date: 2026-02-22
// date: "2026-02-22"
// date: 2026-02-22T10:20:30
function extractDate(raw) {
  const fm = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n/m)
  if (!fm) return null
  const body = fm[1]
  const m = body.match(/^\s*date:\s*["']?([0-9]{4}-[0-9]{2}-[0-9]{2})(?:[T\s].*)?["']?\s*$/m)
  if (!m) return null
  return m[1] // YYYY-MM-DD
}

function ymFromDate(ymd) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(ymd)
  if (!m) return null
  return [m[1], m[2]]
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

// flat 구조 가정: content 루트의 md만 대상
const files = listMarkdownFilesFlat(absContent)

// 홈은 유지
const exclude = new Set(["index.md"])
const targets = files.filter((f) => !exclude.has(path.basename(f)))

let moved = 0
for (const file of targets) {
  const raw = fs.readFileSync(file, "utf8")
  const date = extractDate(raw)
  if (!date) continue

  const ym = ymFromDate(date)
  if (!ym) continue

  const [year, month] = ym
  const baseName = path.basename(file)
  const dstBase = path.join(absContent, year, month, baseName)

  // 충돌 시 _1, _2...
  let dst = dstBase
  let i = 1
  while (fs.existsSync(dst)) {
    const ext = path.extname(baseName)
    const name = path.basename(baseName, ext)
    dst = path.join(absContent, year, month, `${name}_${i}${ext}`)
    i++
  }

  safeMove(file, dst)
  moved++
}

console.log(`Done. moved=${moved}`)

// (옵션) 월 폴더 표시용 index.md 자동 생성
if (!DRY_RUN) {
  const years = fs.readdirSync(absContent, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))

  for (const y of years) {
    const yearDir = path.join(absContent, y.name)
    const months = fs.readdirSync(yearDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{2}$/.test(d.name))

    for (const m of months) {
      const monthDir = path.join(yearDir, m.name)
      const idx = path.join(monthDir, "index.md")
      if (!fs.existsSync(idx)) {
        fs.writeFileSync(idx, `---\ntitle: "${y.name}-${m.name}"\n---\n`, "utf8")
      }
    }
  }
}
