import { chromium } from 'playwright'

console.log('🔍 Starting detailed browser debugging...')

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage()

// Capture all console messages
page.on('console', msg => {
  const type = msg.type()
  const text = msg.text()
  const timestamp = new Date().toLocaleTimeString()
  
  const icon = {
    error: '🔴',
    warning: '🟡', 
    info: '🔵',
    log: '📝'
  }[type] || '📝'
  
  console.log(`${timestamp} ${icon} [${type.toUpperCase()}] ${text}`)
})

// Capture ALL network requests including 404s
page.on('response', response => {
  const status = response.status()
  const url = response.url()
  
  if (status >= 400) {
    console.log(`🌐 ${status} ${url}`)
  } else if (status < 300) {
    // Only log non-HTML/CSS/JS files to reduce noise
    const ext = url.split('?')[0].split('.').pop()
    if (['wasm', 'glb', 'vrm', 'hdr', 'jpg', 'png', 'mp3', 'mp4'].includes(ext)) {
      console.log(`✅ ${status} ${url}`)
    }
  }
})

page.on('requestfailed', request => {
  console.log(`❌ Request failed: ${request.url()} - ${request.failure()?.errorText}`)
})

// Navigate and wait
console.log('🔗 Navigating to http://localhost:4444...')
await page.goto('http://localhost:4444')

console.log('⏳ Waiting 30 seconds to observe loading process...')
await page.waitForTimeout(30000)

console.log('✅ Debugging complete')
await browser.close() 