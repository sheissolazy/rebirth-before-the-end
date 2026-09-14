import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
const out = process.env.E2E_OUT ?? '/tmp/e2e'; mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 400, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:4173/')
await page.click('button:has-text("健壮")'); await page.click('button:has-text("社恐")')
await page.fill('input[placeholder="留空随机"]', 'shot4'); await page.click('button:has-text("睁开眼")')
await page.waitForTimeout(400)
const settle = async () => { for (let i = 0; i < 3; i++) { const m = await page.$('text=突发'); const b = await page.$('div.fixed button:not([disabled])'); if (!m || !b) return; await b.click(); await page.waitForTimeout(150); const c = await page.$('div.fixed button:has-text("继续")'); if (c) await c.click(); await page.waitForTimeout(150) } }
await settle()
await page.click('nav >> text=人物'); await page.waitForTimeout(200)
await page.click('button:has-text("送礼")'); await page.waitForTimeout(200)
const g = await page.$('div.fixed li button'); if (g) await g.click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${out}/notice.png` })
await page.click('nav >> text=地图'); await page.waitForTimeout(200)
await page.click('text=去上班'); await page.selectOption('select', 'hero'); await page.click('button:has-text("放入")')
await page.click('nav >> text=过一周'); await page.waitForSelector('text=本周结算')
await page.screenshot({ path: `${out}/report.png` })
console.log('ERRORS:', errors)
await browser.close()
