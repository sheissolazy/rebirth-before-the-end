import { chromium } from 'playwright'
const out = process.env.E2E_OUT ?? '/tmp/e2e'
import { mkdirSync } from 'fs'; mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 400, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:4173/')
await page.click('button:has-text("健壮")'); await page.click('button:has-text("社恐")')
await page.fill('input[placeholder="留空随机"]', 'shot3'); await page.click('button:has-text("睁开眼")')
await page.waitForTimeout(400)
const settle = async () => { for (let i = 0; i < 3; i++) { const m = await page.$('text=突发'); const b = await page.$('div.fixed button:not([disabled])'); if (!m || !b) return; await b.click(); await page.waitForTimeout(150); const c = await page.$('div.fixed button:has-text("继续")'); if (c) await c.click(); await page.waitForTimeout(150) } }
await settle()
await page.click('nav >> text=仓库'); await page.waitForTimeout(200)
for (const name of ['砍刀', '大米 5kg', '一箱矿泉水', '一箱罐头', '压缩饼干']) { const b = await page.$(`li:has-text("${name}") button:has-text("购买")`); if (b) await b.click() }
await page.click('nav >> text=地图'); await page.waitForTimeout(200)
await page.click('text=去上班'); await page.waitForTimeout(200)
await page.screenshot({ path: `${out}/panel-prologue.png` })
await page.click('button:has-text("关闭")')
for (let i = 0; i < 5; i++) { await settle(); await page.click('nav >> text=过一周'); await page.waitForSelector('text=本周结算'); await page.click('text=继续'); await page.waitForTimeout(150) }
await settle()
await page.click('nav >> text=地图'); await page.waitForTimeout(200)
await page.screenshot({ path: `${out}/map-apoc.png`, fullPage: true })
await page.click('text=猎杀丧尸取晶核'); await page.waitForTimeout(200)
await page.selectOption('select >> nth=0', 'hero')
const sel = await page.$$('select'); if (sel[2]) { const opts = await sel[2].$$eval('option', (o) => o.map((x) => x.value)); if (opts[1]) await sel[2].selectOption(opts[1]) }
await page.waitForTimeout(150)
await page.screenshot({ path: `${out}/panel-apoc.png` })
await page.click('button:has-text("关闭")')
await page.click('nav >> text=人物'); await page.waitForTimeout(200)
await page.screenshot({ path: `${out}/people.png`, fullPage: true })
console.log('ERRORS:', errors)
await browser.close()
