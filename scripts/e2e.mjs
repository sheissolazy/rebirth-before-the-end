import { chromium } from 'playwright'
const out = process.env.E2E_OUT ?? '/tmp/e2e'
import { mkdirSync } from 'fs'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 400, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
await page.goto('http://localhost:4173/')
await page.screenshot({ path: `${out}/01-start.png`, fullPage: true })
// 选一对收支平衡的特质
await page.click('button:has-text("健壮")')
await page.click('button:has-text("社恐")')
await page.fill('input[placeholder="留空随机"]', 'e2e')
await page.click('button:has-text("睁开眼")')
await page.waitForTimeout(500)
// 突发选择
const settleChoice = async () => {
  for (let i = 0; i < 3; i++) {
    const modal = await page.$('text=突发')
    if (!modal) return
    const btn = await page.$('div.fixed button:not([disabled])')
    await btn.click()
    await page.waitForTimeout(200)
    const cont = await page.$('div.fixed button:has-text("继续")')
    if (cont) await cont.click()
    await page.waitForTimeout(200)
  }
}
await settleChoice()
await page.waitForSelector('text=去上班')
await page.screenshot({ path: `${out}/02-map.png`, fullPage: true })
await page.click('text=去上班')
await page.selectOption('select', 'hero')
await page.click('button:has-text("放入")')
await page.waitForSelector('text=进行中')
// 第二件事：跟邻居混熟（精力 1，剩 1 正好够）
await page.click('text=跟邻居混熟')
await page.selectOption('select', 'hero')
await page.click('button:has-text("放入")')
await page.waitForTimeout(200)
const top1 = await page.textContent('header')
console.log('AFTER 2 PLACEMENTS:', top1)
await page.click('nav >> text=仓库')
const buyButtons = await page.$$('button:has-text("购买")')
for (let i = 0; i < 4; i++) await buyButtons[i].click()
await page.click('nav >> text=过一周')
await page.waitForSelector('text=本周结算')
await page.screenshot({ path: `${out}/06-report.png` })
await page.click('text=继续')
for (let i = 0; i < 4; i++) {
  await settleChoice()
  await page.click('nav >> text=过一周')
  await page.waitForSelector('text=本周结算')
  await page.click('text=继续')
}
await settleChoice()
await page.click('nav >> text=地图')
await page.screenshot({ path: `${out}/07-apocalypse-map.png`, fullPage: true })
console.log('TOPBAR:', await page.textContent('header'))
console.log('ERRORS:', errors)
await browser.close()
