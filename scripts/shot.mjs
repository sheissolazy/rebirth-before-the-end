import { chromium } from 'playwright'
const out = process.env.E2E_OUT ?? '/tmp/e2e'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 400, height: 800 } })
await page.goto('http://localhost:4173/')
await page.click('button:has-text("健壮")'); await page.click('button:has-text("社恐")')
await page.fill('input[placeholder="留空随机"]', 'shot'); await page.click('button:has-text("睁开眼")')
await page.waitForTimeout(400)
const b = await page.$('div.fixed button:not([disabled])'); if (b) { await b.click(); await page.waitForTimeout(200); const c = await page.$('div.fixed button:has-text("继续")'); if (c) await c.click() }
await page.click('nav >> text=仓库'); await page.waitForTimeout(200)
await page.screenshot({ path: `${out}/shop.png`, fullPage: true })
await page.click('nav >> text=人物'); await page.waitForTimeout(200)
await page.click('button:has-text("送礼")'); await page.waitForTimeout(200)
await page.screenshot({ path: `${out}/gift.png` })
await page.click('button:has-text("关闭")')
await page.click('nav >> text=基地'); await page.waitForTimeout(200)
await page.screenshot({ path: `${out}/base.png`, fullPage: true })
await browser.close()
