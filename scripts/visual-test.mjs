#!/usr/bin/env node

import 'dotenv-flow/config';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOT_DIR = join(__dirname, '..', 'visual-test-screenshots');
const SKYBOX_THRESHOLD = 0.3; // 30% skybox pixels threshold - if more than this, we're stuck on skybox
const WAIT_TIME = 30000; // Wait time before taking screenshot (increased to 30s)
const MAX_RETRIES = 1;
const TOTAL_TIMEOUT = 120000; // 120 seconds total timeout
const DEV_SERVER_TIMEOUT = 60000; // 60 seconds for dev server to start
const BACKEND_PORT = process.env.PORT || 3000;

// Ensure screenshot directory exists
await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBackendServer(port, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await delay(1000);
  }
  
  throw new Error(`Backend server did not start within ${timeout/1000} seconds`);
}

async function waitForDevServer(devServer, timeout = DEV_SERVER_TIMEOUT) {
  const startTime = Date.now();
  let actualPort = null;
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Dev server did not start within ${timeout/1000} seconds`));
    }, timeout);
    
    const checkOutput = (data) => {
      const output = data.toString();
      console.log('Dev server:', output.trim());
      
      // Look for Vite's port announcement
      const portMatch = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
      if (portMatch) {
        actualPort = portMatch[1];
        clearTimeout(timeoutId);
        resolve(actualPort);
      }
    };
    
    devServer.stdout.on('data', checkOutput);
    devServer.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('Dev server error:', output);
      checkOutput(data); // Sometimes Vite outputs to stderr
    });
  });
}

async function runVisualTest(attempt = 1) {
  console.log(`\n🎯 Visual Test`);
  console.log('=====================================');
  
  // Kill any existing servers first
  console.log('🧹 Cleaning up existing servers...');
  try {
    spawn('pkill', ['-f', 'node build/index.js'], { shell: true });
    spawn('pkill', ['-f', 'vite'], { shell: true });
    await delay(2000); // Give processes time to die
  } catch (e) {
    // Ignore errors if processes don't exist
  }
  
  let backendServer = null;
  let devServer = null;
  let devServerOutput = '';
  
  try {
    // First build the project to ensure backend can run
    console.log('🔨 Building project...');
    const buildProcess = spawn('npm', ['run', 'build:no-typecheck'], {
      shell: true,
      stdio: 'inherit'
    });
    
    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
    });
    
    // Start backend server
    console.log(`🚀 Starting backend server on port ${BACKEND_PORT}...`);
    backendServer = spawn('npm', ['start'], {
      shell: true,
      stdio: 'pipe',
      env: { 
        ...process.env,
        PORT: BACKEND_PORT,
        WORLD: process.env.WORLD || './world',
        PUBLIC_ASSETS_URL: `http://localhost:${BACKEND_PORT}/assets/`,
        PUBLIC_WS_URL: `ws://localhost:${BACKEND_PORT}/ws`,
        // Explicitly unset LiveKit variables for testing
        LIVEKIT_URL: '',
        LIVEKIT_API_KEY: '',
        LIVEKIT_API_SECRET: ''
      }
    });
    
    backendServer.stdout.on('data', (data) => {
      console.log('Backend:', data.toString().trim());
    });
    
    backendServer.stderr.on('data', (data) => {
      console.error('Backend error:', data.toString().trim());
    });
    
    // Wait for backend to be ready
    await waitForBackendServer(BACKEND_PORT);
    console.log(`✅ Backend server is ready on port ${BACKEND_PORT}`);
    
    // Start frontend dev server
    console.log('🚀 Starting frontend dev server...');
    devServer = spawn('npm', ['run', 'dev:vite'], {
      shell: true,
      stdio: 'pipe',
      env: { 
        ...process.env,
        PUBLIC_WS_URL: `ws://localhost:${BACKEND_PORT}/ws`,
        PUBLIC_ASSETS_URL: `http://localhost:${BACKEND_PORT}/assets/`,
        // Explicitly unset LiveKit variables for testing
        LIVEKIT_URL: '',
        LIVEKIT_API_KEY: '',
        LIVEKIT_API_SECRET: ''
      }
    });

    let actualPort = null;
    
    devServer.stdout.on('data', (data) => {
      const output = data.toString();
      devServerOutput += output;
    });
    
    devServer.stderr.on('data', (data) => {
      const output = data.toString();
      devServerOutput += output;
    });

    // Wait for dev server and get actual port
    actualPort = await waitForDevServer(devServer);
    const TEST_URL = `http://localhost:${actualPort}`;
    console.log(`✅ Frontend dev server is ready on port ${actualPort}`);

    // Launch browser
    console.log('🌐 Launching browser...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Listen for console messages
    const consoleMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        console.error('Browser console error:', text);
      } else if (text.includes('[ClientLoader]') || text.includes('WebSocket')) {
        console.log('Browser console:', text);
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    // Listen for network failures
    const networkErrors = [];
    page.on('requestfailed', request => {
      const failure = {
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText || 'Unknown error'
      };
      networkErrors.push(failure);
      console.error(`Network request failed: ${request.method()} ${request.url()} - ${failure.failure}`);
    });

    // Navigate to the page
    console.log(`📍 Navigating to ${TEST_URL}...`);
    await page.goto(TEST_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait for initial load
    console.log(`⏳ Waiting ${WAIT_TIME/1000} seconds for world to load...`);
    
    // Check world state periodically
    let lastLogTime = Date.now();
    const checkInterval = setInterval(async () => {
      try {
        const worldState = await page.evaluate(() => {
          const world = window.world;
          if (!world) return { exists: false };
          
          return {
            exists: true,
            frame: world.frame || 0,
            time: world.time || 0,
            systemsCount: world.systems?.length || 0,
            systems: world.systems?.map(s => s.constructor.name) || [],
            
            // Loader state
            loader: {
              exists: !!world.loader,
              preloadItems: world.loader?.preloadItems?.length || 0,
              preloaderActive: !!world.loader?.preloader,
              promises: world.loader?.promises?.size || 0,
              results: world.loader?.results?.size || 0
            },
            
            // Settings state
            settings: {
              exists: !!world.settings,
              title: world.settings?.title || null,
              model: world.settings?.model || null,
              modelUrl: typeof world.settings?.model === 'object' ? world.settings?.model?.url : world.settings?.model,
              avatar: world.settings?.avatar || null
            },
            
            // Environment state
            environment: {
              exists: !!world.environment,
              baseModel: world.environment?.base?.model || null,
              modelExists: !!world.environment?.model,
              skyExists: !!world.environment?.sky,
              csmExists: !!world.environment?.csm
            },
            
            // Graphics state
            graphics: {
              exists: !!world.graphics,
              rendererExists: !!world.graphics?.renderer,
              rendererInitialized: !!(world.graphics?.renderer?.domElement),
              viewportSize: world.graphics ? `${world.graphics.width}x${world.graphics.height}` : 'N/A'
            },
            
            // Network state
            network: {
              exists: !!world.network,
              wsExists: !!world.network?.ws,
              wsState: world.network?.ws?.readyState,
              wsStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][world.network?.ws?.readyState] || 'UNKNOWN',
              id: world.network?.id || null
            },
            
            // Entities state
            entities: {
              count: world.entities?.getAll?.()?.length || 0,
              types: world.entities?.getAll?.()?.map(e => e.data?.type) || [],
              playerExists: !!world.entities?.player,
              playerId: world.entities?.player?.data?.id || null
            },
            
            // Stage state
            stage: {
              exists: !!world.stage,
              sceneExists: !!world.stage?.scene,
              childrenCount: world.stage?.scene?.children?.length || 0
            }
          };
        });

        const now = Date.now();
        if (now - lastLogTime > 5000) { // Log every 5 seconds
          console.log('\n📊 World State:');
          console.log(`  🎮 World exists: ${worldState.exists}`);
          if (worldState.exists) {
            console.log(`  📦 Frame: ${worldState.frame}, Time: ${worldState.time.toFixed(2)}s`);
            console.log(`  🔧 Systems (${worldState.systemsCount}): ${worldState.systems.slice(0, 5).join(', ')}...`);
            console.log(`  📥 Loader: ${worldState.loader.exists ? `${worldState.loader.results} loaded, ${worldState.loader.promises} loading` : 'Not found'}`);
            console.log(`  ⚙️ Settings: model=${worldState.settings.modelUrl || 'none'}`);
            console.log(`  🌍 Environment: model=${worldState.environment.modelExists}, sky=${worldState.environment.skyExists}`);
            console.log(`  🎨 Graphics: renderer=${worldState.graphics.rendererInitialized}, size=${worldState.graphics.viewportSize}`);
            console.log(`  🌐 Network: ${worldState.network.wsStateText} (id=${worldState.network.id || 'none'})`);
            console.log(`  👥 Entities: ${worldState.entities.count} total, player=${worldState.entities.playerExists}`);
            console.log(`  🎭 Stage: ${worldState.stage.childrenCount} children`);
          }
          lastLogTime = now;
        }
      } catch (error) {
        console.error('Error checking world state:', error);
      }
    }, 1000);

    await delay(WAIT_TIME);
    clearInterval(checkInterval);

    // Get final world diagnostics
    const diagnostics = await page.evaluate(() => {
      const world = window.world;
      if (!world) return null;

      // Check for any ready events
      const readyEvents = [];
      if (world._events?.ready) {
        readyEvents.push('World has ready listeners');
      }

      return {
        worldExists: true,
        frame: world.frame || 0,
        
        rendererInfo: {
          exists: !!world.graphics?.renderer,
          initialized: !!(world.graphics?.renderer?.domElement),
          inDOM: !!(world.graphics?.renderer?.domElement?.parentNode),
          size: world.graphics ? `${world.graphics.width}x${world.graphics.height}` : 'N/A'
        },
        
        entitiesInfo: {
          count: world.entities?.getAll?.()?.length || 0,
          list: world.entities?.getAll?.()?.map(e => ({
            type: e.data?.type,
            id: e.data?.id,
            position: e.data?.position
          })) || []
        },
        
        stageInfo: {
          sceneChildren: world.stage?.scene?.children?.length || 0,
          sceneChildTypes: world.stage?.scene?.children?.map(c => c.type || c.constructor.name) || []
        },
        
        playerInfo: {
          exists: !!world.entities?.player,
          id: world.entities?.player?.data?.id,
          position: world.entities?.player?.base?.position,
          avatarLoaded: !!world.entities?.player?.avatar
        },
        
        environmentInfo: {
          modelLoaded: !!world.environment?.model,
          skyVisible: world.environment?.sky?.visible,
          baseModel: world.environment?.base?.model,
          settingsModel: world.settings?.model
        },
        
        readyEvents,
        
        loaderInfo: {
          preloadCount: world.loader?.preloadItems?.length || 0,
          loadedCount: world.loader?.results?.size || 0,
          preloaderDone: !world.loader?.preloader
        }
      };
    });

    console.log('\n📊 Final World Diagnostics:');
    console.log(JSON.stringify(diagnostics, null, 2));

    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    const screenshotPath = join(SCREENSHOT_DIR, `test-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Analyze the screenshot
    console.log('🔍 Analyzing screenshot...');
    const metadata = await sharp(screenshotPath).metadata();
    const { width, height } = metadata;
    
    // Get center region (30% of width/height)
    const centerWidth = Math.floor(width * 0.3);
    const centerHeight = Math.floor(height * 0.3);
    const left = Math.floor((width - centerWidth) / 2);
    const top = Math.floor((height - centerHeight) / 2);

    // Extract center region and analyze
    const centerRegion = await sharp(screenshotPath)
      .extract({ left, top, width: centerWidth, height: centerHeight })
      .raw()
      .toBuffer();

    let blackPixels = 0;
    let skyboxPixels = 0;
    const totalPixels = centerWidth * centerHeight;
    
    // Check each pixel (RGB format)
    for (let i = 0; i < centerRegion.length; i += 3) {
      const r = centerRegion[i];
      const g = centerRegion[i + 1];
      const b = centerRegion[i + 2];
      
      // Check if pixel is black (loading screen)
      if (r < 10 && g < 10 && b < 10) {
        blackPixels++;
      }
      
      // Check if pixel matches skybox color #6acdff (rgb(106, 205, 255))
      // Allow some tolerance for compression/rendering differences
      const rDiff = Math.abs(r - 106);
      const gDiff = Math.abs(g - 205);
      const bDiff = Math.abs(b - 255);
      
      if (rDiff < 30 && gDiff < 30 && bDiff < 30) {
        skyboxPixels++;
      }
    }

    const blackPercentage = (blackPixels / totalPixels) * 100;
    const skyboxPercentage = (skyboxPixels / totalPixels) * 100;
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`  - Screenshot dimensions: ${width}x${height}`);
    console.log(`  - Center region: ${centerWidth}x${centerHeight}`);
    console.log(`  - Black pixels: ${blackPixels}/${totalPixels} (${blackPercentage.toFixed(2)}%)`);
    console.log(`  - Skybox-colored pixels: ${skyboxPixels}/${totalPixels} (${skyboxPercentage.toFixed(2)}%)`);
    console.log(`  - Black threshold: 80%`);
    console.log(`  - Skybox threshold: ${SKYBOX_THRESHOLD * 100}%`);

    // Save diagnostic screenshot with center region marked
    const diagnosticPath = join(SCREENSHOT_DIR, `diagnostic-${Date.now()}.png`);
    await sharp(screenshotPath)
      .composite([{
        input: Buffer.from(
          `<svg width="${width}" height="${height}">
            <rect x="${left}" y="${top}" width="${centerWidth}" height="${centerHeight}" 
                  fill="none" stroke="red" stroke-width="3" stroke-dasharray="10,5" />
            <text x="${left + centerWidth/2}" y="${top - 10}" 
                  text-anchor="middle" fill="red" font-size="20" font-weight="bold">
              Analysis Region (${blackPercentage.toFixed(1)}% black, ${skyboxPercentage.toFixed(1)}% skybox)
            </text>
          </svg>`
        ),
        top: 0,
        left: 0
      }])
      .toFile(diagnosticPath);

    // Log console messages summary
    const errorCount = consoleMessages.filter(m => m.type === 'error').length;
    const warningCount = consoleMessages.filter(m => m.type === 'warning').length;
    console.log(`\n📋 Console Summary: ${errorCount} errors, ${warningCount} warnings`);
    if (errorCount > 0) {
      console.log('Console errors:');
      consoleMessages.filter(m => m.type === 'error').slice(0, 5).forEach(m => {
        console.log(`  - ${m.text.substring(0, 200)}${m.text.length > 200 ? '...' : ''}`);
      });
    }

    // Log network errors
    if (networkErrors.length > 0) {
      console.log(`\n🚫 Network Errors (${networkErrors.length}):`);
      networkErrors.slice(0, 5).forEach(err => {
        console.log(`  - ${err.method} ${err.url}: ${err.failure}`);
      });
    }

    await browser.close();

    // Check result with diagnostics
    const worldReady = diagnostics?.rendererInfo?.initialized && diagnostics?.entitiesInfo?.count > 0;
    if (!worldReady) {
      console.log('\n⚠️ World not fully loaded:');
      console.log(`  - Renderer initialized: ${diagnostics?.rendererInfo?.initialized}`);
      console.log(`  - Entities count: ${diagnostics?.entitiesInfo?.count}`);
      console.log(`  - Environment model: ${diagnostics?.environmentInfo?.modelLoaded}`);
      throw new Error('World did not fully load');
    }

    // Determine the state
    let state = 'unknown';
    let errorMessage = null;
    
    if (blackPercentage > 80) {
      state = 'loading';
      errorMessage = `Loading overlay still visible: ${blackPercentage.toFixed(2)}% black pixels`;
    } else if (skyboxPercentage > SKYBOX_THRESHOLD * 100) {
      state = 'broken';
      errorMessage = `Renderer not rendering properly: ${skyboxPercentage.toFixed(2)}% skybox pixels`;
    } else {
      state = 'working';
    }
    
    console.log(`\n🎯 State: ${state.toUpperCase()}`);
    
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    console.log('\n✅ Visual test passed!');
    console.log(`  - Screenshot saved: ${screenshotPath}`);
    console.log(`  - Diagnostic saved: ${diagnosticPath}`);
    return true;

  } catch (error) {
    console.error('\n❌ Visual test failed:', error.message);
    
    if (devServerOutput) {
      console.log('\n📝 Dev Server Output:');
      console.log(devServerOutput.slice(-2000)); // Last 2000 chars
    }
    
    throw error;
  } finally {
    // Clean up servers
    if (devServer) {
      devServer.kill();
    }
    if (backendServer) {
      backendServer.kill();
    }
    await delay(1000); // Give them time to clean up
  }
}

// Run test without retries and with timeout
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error(`Test timed out after ${TOTAL_TIMEOUT/1000} seconds`)), TOTAL_TIMEOUT);
});

try {
  await Promise.race([
    runVisualTest(1),
    timeoutPromise
  ]);
  
  process.exit(0);
} catch (error) {
  console.error('\n💥 Test failed:', error.message);
  process.exit(1);
} 