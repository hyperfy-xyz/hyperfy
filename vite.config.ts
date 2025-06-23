import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Define which env variables are exposed to client
  envPrefix: 'PUBLIC_', // Only expose env vars starting with PUBLIC_
  
  root: path.resolve(__dirname, 'src/client'),
  publicDir: 'public',
  
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    target: 'esnext', // Support top-level await
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/client/index.html')
      }
    }
  },
  
  esbuild: {
    target: 'esnext' // Support top-level await
  },
  
  define: {
    'process.env': '{}', // Replace process.env with empty object
    'process': 'undefined' // Replace process with undefined
  },
  
  server: {
    port: Number(process.env.VITE_PORT) || 3001,
    open: false,
    host: true
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@client': path.resolve('./src/client'),
      '@core': path.resolve('./src/core'),
      '@types': path.resolve('./src/types'),
    },
  },
  
  optimizeDeps: {
    include: ['three', 'react', 'react-dom'],
    esbuildOptions: {
      target: 'esnext' // Support top-level await
    }
  },
}) 