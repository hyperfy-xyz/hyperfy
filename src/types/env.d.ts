/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_URL?: string
  readonly PUBLIC_ASSETS_URL?: string
  readonly PUBLIC_WS_URL?: string
  readonly PUBLIC_MAX_UPLOAD_SIZE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 