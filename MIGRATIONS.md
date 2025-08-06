# Migration Guide

## 0.15.0 -> X.XX.X

- The `PUBLIC_ASSETS_URL` environment variable was renamed to `ASSETS_BASE_URL`.
- A new `ASSETS=local` environment variable is now required. This can also be set to `s3` allowing assets to be stored in a remote S3-compatible bucket with `ASSETS_S3_URI` (such as Amazon S3 and Cloudflare R2)
- A new `CLEAN` environment variable has been added which defaults to `CLEAN=true` for new installations. When enabled, all unused data (blueprints and assets) are purged during world startup.