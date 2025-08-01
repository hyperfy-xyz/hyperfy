// Color utilities for primitives
// Converts basic color names to vibrant HSL values optimized for GPU animation

const COLOR_MAP = {
  // Basic colors with vibrant HSL values
  red: { h: 0, s: 85, l: 50 },
  orange: { h: 30, s: 90, l: 55 },
  yellow: { h: 60, s: 90, l: 55 },
  green: { h: 120, s: 80, l: 45 },
  cyan: { h: 180, s: 85, l: 50 },
  blue: { h: 240, s: 85, l: 50 },
  purple: { h: 270, s: 80, l: 50 },
  magenta: { h: 300, s: 85, l: 50 },
  pink: { h: 330, s: 80, l: 60 },
  
  // Neutrals
  white: { h: 0, s: 0, l: 95 },
  gray: { h: 0, s: 0, l: 50 },
  grey: { h: 0, s: 0, l: 50 },
  black: { h: 0, s: 0, l: 10 },
  
  // Extended colors
  lime: { h: 90, s: 85, l: 50 },
  teal: { h: 165, s: 75, l: 45 },
  indigo: { h: 255, s: 80, l: 45 },
  violet: { h: 285, s: 80, l: 50 },
  
  // Warm colors
  coral: { h: 15, s: 85, l: 60 },
  salmon: { h: 10, s: 80, l: 65 },
  gold: { h: 45, s: 85, l: 55 },
  
  // Cool colors  
  turquoise: { h: 175, s: 80, l: 50 },
  sky: { h: 200, s: 75, l: 60 },
  navy: { h: 240, s: 70, l: 30 },
}

/**
 * Converts a color input to an HSL string optimized for vibrant GPU animation
 * @param {string} color - Color name, hex (#000000), rgb(r,g,b), rgba(r,g,b,a), or hsl string
 * @returns {string} Color string ready for THREE.js
 */
export function toVibrantHSL(color) {
  if (!color || typeof color !== 'string') {
    return 'hsl(0, 80%, 50%)' // Default vibrant red
  }
  
  const trimmed = color.trim().toLowerCase()
  
  // If it's already HSL, return as-is
  if (trimmed.startsWith('hsl')) {
    return color
  }
  
  // Check if it's a named color
  if (COLOR_MAP[trimmed]) {
    const { h, s, l } = COLOR_MAP[trimmed]
    return `hsl(${h}, ${s}%, ${l}%)`
  }
  
  // Handle hex colors (eg #000000 or #000)
  if (trimmed.startsWith('#')) {
    // Pass through - THREE.Color handles hex
    return color
  }
  
  // Handle rgb/rgba colors (eg rgb(255,0,0) or rgba(255,0,0,0.5))
  if (trimmed.startsWith('rgb')) {
    // For rgba with transparency, we need to extract RGB part
    // THREE.Color doesn't support alpha in color strings
    if (trimmed.startsWith('rgba')) {
      // Extract rgb values, ignore alpha (materials handle transparency separately)
      const match = trimmed.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/)
      if (match) {
        return `rgb(${match[1]}, ${match[2]}, ${match[3]})`
      }
    }
    // Pass through rgb format
    return color
  }
  
  // Default fallback - let THREE.Color try to parse it
  return color
}

/**
 * Gets a random vibrant color for primitives
 * @returns {string} HSL color string
 */
export function getRandomVibrantColor() {
  const hue = Math.random() * 360
  const saturation = 70 + Math.random() * 30 // 70-100%
  const lightness = 45 + Math.random() * 15 // 45-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Creates a color from index for rainbow distribution
 * @param {number} index - Current index
 * @param {number} total - Total count
 * @returns {string} HSL color string
 */
export function getRainbowColor(index, total) {
  const hue = (index / total) * 360
  const saturation = 80 + Math.random() * 20 // 80-100%
  const lightness = 50 + Math.random() * 10 // 50-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}