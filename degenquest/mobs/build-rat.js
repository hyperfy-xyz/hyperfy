#!/usr/bin/env node
/**
 * Build Sewer Rat with Avatar Image
 *
 * Rebuilds rat.hyp with proper avatar image for sidebar display
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import the hyp module
import('/Users/highlander/gamedev/DegenQuest-v33/modules/hyp/lib/index.js').then(async ({ buildHypBuffer, createAsset }) => {
  console.log('🐀 Building Sewer Rat with Avatar Image\n')
  console.log('═'.repeat(80))

  // Load assets
  const MODEL_PATH = '/Users/highlander/gamedev/DegenQuest-v33/modules/mob/assets/a_sewer_rat_v1.glb'
  const SCRIPT_PATH = join(__dirname, '../assets/a18e5fe151c4eeaa68248884799d78a4fc0bd8b6e7ea2c368f9fa11f449884b4.js')
  const AVATAR_PATH = join(__dirname, 'rat.png')

  console.log('\n📦 Loading assets...')

  const modelData = readFileSync(MODEL_PATH)
  const scriptData = readFileSync(SCRIPT_PATH, 'utf-8')
  const avatarData = readFileSync(AVATAR_PATH)

  console.log(`  ✅ Model: ${Math.round(modelData.length / 1024)}KB`)
  console.log(`  ✅ Script: ${Math.round(scriptData.length / 1024)}KB`)
  console.log(`  ✅ Avatar: ${Math.round(avatarData.length / 1024)}KB`)

  // Create assets with SHA256 hashes
  const modelAsset = createAsset('model', modelData, 'model/gltf-binary')
  const scriptAsset = createAsset('script', scriptData, 'application/javascript')
  const avatarAsset = createAsset('image', avatarData, 'image/png')

  console.log(`\n🔑 Asset hashes:`)
  console.log(`  Model:  ${modelAsset.url.substring(8, 50)}...`)
  console.log(`  Script: ${scriptAsset.url.substring(8, 50)}...`)
  console.log(`  Avatar: ${avatarAsset.url.substring(8, 50)}...`)

  // Create blueprint
  const blueprint = {
    id: 'sewer-rat-v1',
    name: 'Sewer Rat v24 (Movement Fix + Avatar)',
    version: 124,
    desc: 'v24 - Client-side interpolation movement + avatar image for UI',
    model: modelAsset.url,
    script: scriptAsset.url,
    image: {
      type: 'image',
      url: avatarAsset.url
    },
    props: {
      npcTypeId: 600001,
      aggressive: true,
      moveSpeed: 9,
      detectionRange: 100,
      attackRange: 6,
      attackCooldown: 1500,
      idleAnimName: 'rat_idle_01',
      walkAnimName: 'rat_walk',
      attackAnimName: 'rat_attack_01',
      deathAnimName: 'rat_death',
      useVariedIdle: true,
      useVariedAttacks: true,
      enableSounds: false
    }
  }

  const assets = [modelAsset, scriptAsset, avatarAsset]

  // Build .hyp file
  console.log('\n📝 Writing .hyp file...')
  const hypBuffer = buildHypBuffer(blueprint, assets)
  const outputPath = join(__dirname, 'rat.hyp')
  writeFileSync(outputPath, Buffer.from(hypBuffer))

  const outputSize = hypBuffer.byteLength || hypBuffer.length
  console.log(`\n✅ Built: ${outputPath}`)
  console.log(`   Size: ${Math.round(outputSize / 1024)}KB`)
  console.log('\n✅ Done! Rat now has avatar image for sidebar display')

}).catch(err => {
  console.error('❌ Build failed:', err.message)
  console.error(err.stack)
  process.exit(1)
})
