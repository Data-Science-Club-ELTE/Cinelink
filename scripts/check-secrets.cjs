// Conservative hygiene check, not an exhaustive security audit. Never prints values.
const fs = require('node:fs')
const path = require('node:path')
const skip = new Set(['node_modules', '.pnpm-store', '.next', '.next-production', '.git', '.verification', 'coverage', 'test-results', 'data/raw', 'data/processed'])
const localSecrets = []
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(\w*(?:PASSWORD|SECRET|API_KEY|TOKEN))\s*=\s*(.+)$/)
    if (match) {
      const value = match[2].trim().replace(/^['"]|['"]$/g, '')
      if (value.length >= 8 && !/^(replace-|your_)/.test(value)) localSecrets.push(value)
    }
  }
}
let count = 0
const findings = []
function walk(dir = '.') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    const relative = file.replaceAll('\\', '/')
    if (entry.isDirectory()) { if (!skip.has(entry.name) && !skip.has(relative)) walk(file); continue }
    if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue
    if (!/\.(?:[cm]?js|jsx|tsx?|json|ya?ml|md|txt|example)$/.test(entry.name)) continue
    const text = fs.readFileSync(file, 'utf8')
    count++
    if (localSecrets.some(value => text.includes(value)) ||
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
        /\b(?:ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{20,}/.test(text) ||
        /(?:bolt|neo4j)(?:\+s|\+ssc)?:\/\/[^\s/:]+:[^\s@]+@/.test(text)) findings.push(relative)
  }
}
walk()
console.log(`Scanned ${count} source/config/documentation files; ${findings.length} potential exposures.`)
for (const file of findings) console.error(`Review sensitive content in: ${file}`)
if (findings.length) process.exitCode = 1
