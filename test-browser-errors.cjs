const puppeteer = require('puppeteer');

const URL = 'http://localhost:3000';
const WAIT_TIME = 10000; // Wait 10 seconds for app to load

(async () => {
  console.log('Starting browser error test...');
  
  // Track all errors
  const errors = [];
  const consoleErrors = [];
  const networkErrors = [];
  
  // Launch browser in headful mode
  const browser = await puppeteer.launch({
    headless: false, // Show the browser window
    devtools: true,  // Open DevTools automatically
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        console.error('[Console Error]', text);
        consoleErrors.push({
          text,
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Listen for page errors
    page.on('error', error => {
      console.error('[Page Error]', error.message);
      errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    // Listen for unhandled promise rejections
    page.on('pageerror', error => {
      console.error('[Page Error]', error.message);
      errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    // Listen for failed requests
    page.on('requestfailed', request => {
      const failure = request.failure();
      console.error('[Request Failed]', request.url(), failure?.errorText);
      networkErrors.push({
        url: request.url(),
        method: request.method(),
        errorText: failure?.errorText,
        timestamp: new Date().toISOString()
      });
    });
    
    // Navigate to the page
    console.log(`Navigating to ${URL}...`);
    
    try {
      await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log('Page loaded successfully');
    } catch (error) {
      console.error('Failed to load page:', error.message);
    }
    
    // Wait for the app to initialize
    console.log(`Waiting ${WAIT_TIME/1000} seconds for app to initialize...`);
    await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
    
    // Check if the canvas exists (Hyperfy uses canvas for rendering)
    const canvasExists = await page.evaluate(() => {
      return document.querySelector('canvas') !== null;
    });
    
    console.log('Canvas element exists:', canvasExists);
    
    // Check for any SES_UNHANDLED_REJECTION errors
    const sesErrors = await page.evaluate(() => {
      const logs = [];
      const originalLog = console.error;
      console.error = function(...args) {
        const message = args.join(' ');
        if (message.includes('SES_UNHANDLED_REJECTION') || 
            message.includes('SES_UNCAUGHT_EXCEPTION')) {
          logs.push(message);
        }
        originalLog.apply(console, args);
      };
      return logs;
    });
    
    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log('Page Errors:', errors.length);
    console.log('Console Errors:', consoleErrors.length);
    console.log('Network Errors:', networkErrors.length);
    console.log('Canvas Found:', canvasExists);
    
    if (errors.length > 0) {
      console.log('\n=== PAGE ERRORS ===');
      errors.forEach((err, i) => {
        console.log(`\nError ${i + 1}:`, err.message);
        if (err.stack) console.log('Stack:', err.stack);
      });
    }
    
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach((err, i) => {
        console.log(`\nConsole Error ${i + 1}:`, err.text);
        if (err.location) console.log('Location:', err.location);
      });
    }
    
    if (networkErrors.length > 0) {
      console.log('\n=== NETWORK ERRORS ===');
      networkErrors.forEach((err, i) => {
        console.log(`\nNetwork Error ${i + 1}:`, err.url);
        console.log('Error:', err.errorText);
      });
    }
    
    // Keep browser open for manual inspection
    console.log('\n\nBrowser will remain open for inspection. Press Ctrl+C to exit.');
    
    // Wait indefinitely (until user closes)
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Test failed:', error);
    await browser.close();
    process.exit(1);
  }
})();
