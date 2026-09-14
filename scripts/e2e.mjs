import { chromium } from 'playwright'
const out = '/tmp/claude-0/-home-user-holdings-tracker/ba400a31-48a4-5a1b-8734-f2be025ba5df/scratchpad'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 400, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
await page.goto('http://localhost:4173/')
await page.screenshot({ path: `${out}/01-start.png` })
await page.fill('input[placeholder="留空随机"]', 'e2e')
await page.click('button:has-text("睁开眼")')
await page.waitForSelector('text=去上班')
await page.screenshot({ path: `${out}/02-map.png`, fullPage: true })
await page.click('text=去上班')
await page.waitForSelector('select')
await page.selectOption('select', 'hero')
await page.click('button:has-text("放入")')
await page.waitForSelector('text=进行中')
// 仓库买东西
await page.click('nav >> text=仓库')
await page.waitForSelector('text=商店')
await page.screenshot({ path: `${out}/03-warehouse.png`, fullPage: true })
const buyButtons = await page.$$('button:has-text("购买")')
for (let i = 0; i < 4; i++) await buyButtons[i].click()
// 基地
await page.click('nav >> text=基地')
await page.screenshot({ path: `${out}/04-base.png`, fullPage: true })
// 人物
await page.click('nav >> text=人物')
await page.screenshot({ path: `${out}/05-people.png`, fullPage: true })
// 过一周
await page.click('nav >> text=过一周')
await page.waitForSelector('text=本周结算')
await page.screenshot({ path: `${out}/06-report.png` })
await page.click('text=继续')
// 连续过到末日
for (let i = 0; i < 4; i++) { await page.click('nav >> text=过一周'); await page.waitForSelector('text=本周结算'); await page.click('text=继续') }
await page.click('nav >> text=地图')
await page.screenshot({ path: `${out}/07-apocalypse-map.png`, fullPage: true })
const top = await page.textContent('header')
console.log('TOPBAR:', top)
console.log('ERRORS:', errors)
await browser.close()
