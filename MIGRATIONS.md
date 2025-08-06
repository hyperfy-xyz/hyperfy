# Migration Guide

## 0.15.0 -> X.XX.X

- The `PUBLIC_ASSETS_URL` environment variable was renamed to `ASSETS_BASE_URL`. This also introduces an `ASSETS=local|s3` environment variable allowing you to optionally store assets in a remote S3-compatible bucket using `ASSETS_S3_URI` (such as Amazon S3 and Cloudflare R2)
- A new `CLEAN` environment variable has been added which defaults to `CLEAN=true` for new installations. When enabled, all unused data (blueprints and assets) are purged during world startup.