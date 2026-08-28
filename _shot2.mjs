import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const PW_BASE = fs.readdirSync('/home/mironoouv/.npm/_npx')
  .map((h) => `/home/mironoouv/.npm/_npx/${h}/node_modules/`)
  .find((p) => fs.existsSync(p + 'playwright'))
const require = createRequire(PW_BASE)
const { chromium } = require('playwright')
const NICK = process.argv[2] || 'mironoouv'
const PAGES = (process.argv[3] || 'menu').split(',')
const OUT = process.argv[4] || '/tmp/claude-1001/-home-mironoouv-minecraft/f2c739e7-d203-4a34-96c6-4cd9762ee555/scratchpad'
const sj = JSON.parse(fs.readFileSync('/mnt/ssd/minecraft_server/config/webgui/server.json', 'utf8'))
const secret = Buffer.from(sj.tokenSecretBase64.trim(), 'base64')
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const payload = `1|${NICK}|${Math.floor(Date.now()/1000)+900}`
const sig = crypto.createHmac('sha256', secret).update(payload).digest()
const token = `${b64u(payload)}.${b64u(sig)}`
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
for (const p of PAGES) {
  try {
    await page.goto(`https://void-rp.ru/game-ui/${p}?webgui_token=${token}`, { waitUntil: 'networkidle', timeout: 25000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${OUT}/shot_${p}.png` })
    console.log('OK', p)
  } catch (e) { console.log('FAIL', p, e.message) }
}
await browser.close()
