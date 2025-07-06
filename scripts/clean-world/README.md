# Clean World Scripts

This directory contains scripts for cleaning unused blueprints and assets from worlds.

## Scripts

- **`clean-world.mjs`** - Main entry point that automatically selects the appropriate cleanup script based on `STORAGE_TYPE`
- **`clean-world-local.mjs`** - Cleans local file system storage
- **`clean-world-s3.mjs`** - Cleans S3-compatible storage (AWS S3, CloudFlare R2, etc.)
- **`clean-world-utils.mjs`** - Shared utilities and functions used by both cleanup scripts

## Usage

### Main Script (Recommended)
```bash
# Automatically detects storage type from STORAGE_TYPE environment variable
node scripts/clean-world.mjs
```

### Direct Script Execution
```bash
# For local storage
node scripts/clean-world/clean-world-local.mjs

# For S3 storage
node scripts/clean-world/clean-world-s3.mjs
```

## Environment Variables

### Database Configuration
- `DB_TYPE` - Database type (`pg` for PostgreSQL, empty for SQLite)
- `DB_URL` - Database connection URL (for PostgreSQL)

### Storage Configuration
- `STORAGE_TYPE` - Storage type (`s3` for S3-compatible, `local` or empty for local files)
- `S3_BUCKET_NAME` - S3 bucket name (required for S3 storage)
- `S3_ACCESS_KEY_ID` - S3 access key ID
- `S3_SECRET_ACCESS_KEY` - S3 secret access key
- `S3_REGION` - S3 region (defaults to `us-east-1`)
- `S3_ASSETS_PREFIX` - Assets prefix in S3 (defaults to `assets/`)

### Other
- `WORLD` - World name (defaults to `world`)
- `DRY_RUN` - Set to `true` to preview changes without deleting (not implemented in main script)

## What It Does

1. **Phase 1**: Removes unused blueprints that no entities reference
2. **Phase 2**: Removes unused asset files that are not referenced by:
   - Active blueprints
   - Player avatars
   - World settings (image, model, avatar)

## Architecture

The scripts use a shared utility module (`clean-world-utils.mjs`) to avoid code duplication and ensure both storage types stay in sync when the cleanup logic changes. 