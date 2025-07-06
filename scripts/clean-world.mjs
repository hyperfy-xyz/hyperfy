#!/usr/bin/env node

import 'dotenv-flow/config'

/**
 * Clean World Script
 * Main entry point for world cleaning operations.
 * 
 * Automatically selects the appropriate cleanup script based on STORAGE_TYPE:
 * - STORAGE_TYPE=s3: Uses clean-world-s3.mjs
 * - STORAGE_TYPE=local or unset: Uses clean-world-local.mjs
 * 
 * Usage:
 *   npm run world:clean
 */

const storageType = process.env.STORAGE_TYPE || 'local'

if (storageType === 's3') {
    console.log('Running S3 cleanup...')
    await import('./clean-world/clean-world-s3.mjs')
} else {
    console.log('Running local cleanup...')
    await import('./clean-world/clean-world-local.mjs')
} 
