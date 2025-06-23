import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Game engine testing configuration
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    
    // Performance optimizations for physics/rendering tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      }
    },
    
    // Timeout for complex simulations
    testTimeout: 30000,
    hookTimeout: 30000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'src/**/*.{test,spec}.{js,ts}',
        'src/__tests__/**',
        'src/types/**',
        'scripts/**',
        'build/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      }
    },
    
    // Custom reporters for game metrics
    reporters: ['default', './src/__tests__/reporters/game-metrics-reporter.ts'],
    
    // WebGL/Canvas mocking
    deps: {
      inline: ['three', '@pixiv/three-vrm'],
    },
    
    // Benchmarking for performance tests
    benchmark: {
      include: ['**/*.bench.{js,ts}'],
      reporters: ['default'],
    }
  },
  
  resolve: {
    alias: {
      '@core': resolve(__dirname, './src/core'),
      '@client': resolve(__dirname, './src/client'),
      '@server': resolve(__dirname, './src/server'),
      '@world': resolve(__dirname, './src/world'),
      '@node-client': resolve(__dirname, './src/node-client'),
      '@types': resolve(__dirname, './src/types'),
      '@test': resolve(__dirname, './src/__tests__'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },
  
  // ESBuild options for faster test compilation
  esbuild: {
    target: 'es2022',
    format: 'esm',
  },
  
  // Define globals for game engine
  define: {
    'import.meta.vitest': 'undefined',
    '__PHYSICS_WASM_URL__': JSON.stringify('/src/core/physx-js-webidl.wasm'),
    '__ASSETS_URL__': JSON.stringify('https://assets.hyperfy.io/'),
  }
}); 