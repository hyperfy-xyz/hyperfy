import { chromium } from 'playwright'

console.log('🔍 Hunting for the 404 error...')

const browser = await chromium.launch()
const page = await browser.newPage()

// Capture the specific 404 request
page.on('response', response => {
  if (response.status() === 404) {
    console.log(`🔴 404 FOUND: ${response.url()}`)
    console.log(`   Method: ${response.request().method()}`)
    console.log(`   Headers: ${JSON.stringify(response.request().headers(), null, 2)}`)
  }
})

// Also capture failed requests
page.on('requestfailed', request => {
  console.log(`❌ Request failed: ${request.url()}`)
  console.log(`   Error: ${request.failure()?.errorText}`)
})

console.log('🔗 Navigating to http://localhost:4444...')
await page.goto('http://localhost:4444')

console.log('⏳ Waiting 10 seconds for all requests...')
await page.waitForTimeout(10000)

console.log('✅ Hunt complete')
await browser.close() 