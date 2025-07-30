import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import moment from 'moment'

const world = process.env.WORLD || 'world'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, world)
const backupsDir = path.join(worldDir, 'backups')

// Ensure the backups directory exists inside the world folder
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
  console.log('Created backups directory inside world folder')
}

// Check if world directory exists
if (!fs.existsSync(worldDir)) {
  console.error(`World directory not found: ${worldDir}`)
  process.exit(1)
}

// Generate backup filename with timestamp
const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss')
const backupFileName = `backup_${timestamp}.tar.gz`
const backupFilePath = path.join(backupsDir, backupFileName)

console.log(`Creating backup: ${backupFileName}`)

try {
  // Use system tar command for compression
  const tarCommand = `tar -czf "${backupFilePath}" -C "${rootDir}" --exclude="${world}/backups" "${world}"`

  console.log('Running tar command...')
  execSync(tarCommand, {
    stdio: 'inherit',
  })

  // Get backup file size
  const stats = fs.statSync(backupFilePath)
  const fileSizeInMB = (stats.size / 1024 / 1024).toFixed(2)

  console.log(`Backup created successfully: ${backupFileName}`)
  console.log(`Backup size: ${fileSizeInMB} MB`)

  // Clean up old backups (keep only 7 most recent)
  await cleanupOldBackups()

  console.log('Backup process completed!')
} catch (error) {
  console.error('Error creating backup:', error)
  console.error('Make sure tar is installed on your system')
  process.exit(1)
}

/**
 * Clean up old backups, keeping only the 7 most recent ones
 */
async function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(backupsDir)

    // Filter for backup files (tar.gz files that match our naming pattern)
    const backupFiles = files.filter(file => file.endsWith('.tar.gz') && file.includes('backup_'))

    if (backupFiles.length <= 7) {
      console.log(`Found ${backupFiles.length} backup files, no cleanup needed`)
      return
    }

    // Sort files by modification time (newest first)
    const filesWithStats = backupFiles.map(file => {
      const filePath = path.join(backupsDir, file)
      const stats = fs.statSync(filePath)
      return {
        name: file,
        path: filePath,
        mtime: stats.mtime,
      }
    })

    filesWithStats.sort((a, b) => b.mtime - a.mtime)

    // Delete files beyond the 7 most recent
    const filesToDelete = filesWithStats.slice(7)

    console.log(`Cleaning up ${filesToDelete.length} old backup files`)

    for (const file of filesToDelete) {
      fs.removeSync(file.path)
      console.log(`Deleted old backup: ${file.name}`)
    }
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
}
