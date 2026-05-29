import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(__dirname, '../public/icon-source.svg'))

const sizes = [
  { name: 'apple-touch-icon.png',     size: 180 },  // iOS home screen
  { name: 'apple-touch-icon-167.png', size: 167 },  // iPad Pro
  { name: 'apple-touch-icon-152.png', size: 152 },  // iPad @2x
  { name: 'apple-touch-icon-120.png', size: 120 },  // iPhone @2x
  { name: 'icon-192.png',             size: 192 },  // PWA manifest
  { name: 'icon-512.png',             size: 512 },  // PWA manifest splash
  { name: 'favicon.png',              size: 32  },  // browser tab
]

for (const { name, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(__dirname, '../public', name))
  console.log(`✓ ${name} (${size}×${size})`)
}
