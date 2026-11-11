/**
 * Hyperfy Progression, Missions, and Storyline System
 *
 * Designed with a high-intensity, high-energy presentation style
 * while maintaining a non-violent, family-safe sci-fi aesthetic.
 */

export const STORYLINE = {
  title: 'HYPERCORE ODYSSEY: THE ARCHITECT INITIATIVE',
  tagline: 'Synchronize into the quantum substrate. Shape the metaverse.',
  intro:
    'In the late 22nd century, the boundary between digital thought and physical reality collapsed. From the embers of the old web emerged Hyperfy and the HyperCore Grid—an infinite expanse of fractured virtual sectors powered by decentralized real-time simulation cores. You have synchronized into the grid as an inducted Operative. Your mission: explore rogue sectors, align quantum resonance, and ascend to become a Master Architect of persistent worlds.',
  chapters: [
    {
      id: 'ch1',
      title: 'Chapter I: The Spatial Awakening',
      summary:
        'All Operatives receive permanent Free Explorer Clearance. Freely traverse public sectors, socialize with operatives across the globe, test sandbox physics, and experience community worlds without restriction.',
    },
    {
      id: 'ch2',
      title: 'Chapter II: The Daily & Weekly Pulse',
      summary:
        'The HyperCore Matrix pulses with continuous operational missions. Complete high-velocity spatial drifts, communication relays, and interactive builds to harvest Core XP, climb unlock tiers, and synthesize radiant cosmetics, cyber skins, and elite badges.',
    },
    {
      id: 'ch3',
      title: 'Chapter III: The Architect Citadel',
      summary:
        'Every explorer is granted a 14-Day Architect Trial to anchor, construct, and host their very own persistent world sector. When the trial completes, core exploration remains forever free, while upgrading to Architect Pro permanently unlocks unlimited persistent hosting and elite reality permissions.',
    },
  ],
}

export const COSMETIC_ITEMS = [
  {
    id: 'badge_initiate',
    name: 'Initiate Core Badge',
    type: 'badge',
    rarity: 'common',
    desc: 'Awarded upon initial synchronization with the HyperCore Grid.',
    color: '#00e5ff',
    icon: 'Shield',
  },
  {
    id: 'item_quantum_visor',
    name: 'Quantum Cyber Visor',
    type: 'cosmetic',
    rarity: 'rare',
    desc: 'High-contrast holographic HUD overlay projecting realtime spatial vectors.',
    color: '#7928ca',
    icon: 'Sparkles',
  },
  {
    id: 'skin_neon_vanguard',
    name: 'Neon Vanguard Operative',
    type: 'skin',
    rarity: 'epic',
    desc: 'High-energy cyber suit pulsing with electric turquoise luminescence.',
    color: '#00ffcc',
    icon: 'User',
    avatarUrl: 'asset://avatar.vrm',
  },
  {
    id: 'item_hyper_beacon',
    name: 'HyperCore Plasma Beacon',
    type: 'item',
    rarity: 'rare',
    desc: 'Portable quantum resonator emitting high-energy light columns.',
    color: '#ff007f',
    icon: 'Flame',
  },
  {
    id: 'badge_overdrive',
    name: 'Overdrive Surge Badge',
    type: 'badge',
    rarity: 'epic',
    desc: 'Proof of extraordinary persistence during high-intensity grid pulses.',
    color: '#ff0055',
    icon: 'Zap',
  },
  {
    id: 'skin_neon_surge',
    name: 'Neon Surge Architect',
    type: 'skin',
    rarity: 'epic',
    desc: 'Radiant gold and cyan chromatic armor designed for master world builders.',
    color: '#ffd700',
    icon: 'UserCheck',
    avatarUrl: 'asset://avatar.vrm',
  },
  {
    id: 'item_holo_wings',
    name: 'Photon Glider Wings',
    type: 'cosmetic',
    rarity: 'legendary',
    desc: 'Pure holographic energy wings that flare at maximum movement velocity.',
    color: '#9945ff',
    icon: 'Feather',
  },
  {
    id: 'badge_sector_master',
    name: 'Master Architect Crest',
    type: 'badge',
    rarity: 'legendary',
    desc: 'The pinnacle mark of mastery over persistent world sectors.',
    color: '#ffaa00',
    icon: 'Crown',
  },
  {
    id: 'skin_solar_flare',
    name: 'Solar Flare Apex Operative',
    type: 'skin',
    rarity: 'legendary',
    desc: 'Blinding high-contrast solar energy chassis radiating pure overdrive power.',
    color: '#ff3300',
    icon: 'Sun',
    avatarUrl: 'asset://avatar.vrm',
  },
]

export const PROGRESSION_TIERS = [
  {
    tier: 1,
    title: 'Cadet Operative',
    requiredXp: 0,
    rewardId: 'badge_initiate',
  },
  {
    tier: 2,
    title: 'Grid Specialist',
    requiredXp: 200,
    rewardId: 'item_quantum_visor',
  },
  {
    tier: 3,
    title: 'Neon Vanguard',
    requiredXp: 500,
    rewardId: 'skin_neon_vanguard',
  },
  {
    tier: 4,
    title: 'Core Channeler',
    requiredXp: 900,
    rewardId: 'item_hyper_beacon',
  },
  {
    tier: 5,
    title: 'Sector Master',
    requiredXp: 1400,
    rewardId: 'badge_sector_master',
  },
  {
    tier: 6,
    title: 'Apex Overdrive',
    requiredXp: 2000,
    rewardId: 'skin_solar_flare',
  },
]

export const TIER_THRESHOLDS = PROGRESSION_TIERS

export const MISSIONS = [
  {
    id: 'daily_explore',
    type: 'daily',
    title: 'Sector Drift',
    desc: 'Traverse and explore virtual sectors to stabilize spatial coordinates.',
    xp: 100,
    target: 1,
    unit: 'pulse',
    rewardSummary: '+100 XP // Core Charge',
  },
  {
    id: 'daily_emote',
    type: 'daily',
    title: 'Resonance Pulse',
    desc: 'Perform a harmonic emote animation to synchronize neural frequency.',
    xp: 75,
    target: 1,
    unit: 'pulse',
    rewardSummary: '+75 XP // Resonance Spike',
  },
  {
    id: 'daily_chat',
    type: 'daily',
    title: 'Comms Uplink',
    desc: 'Broadcast an encrypted transmission across the sector chat stream.',
    xp: 50,
    target: 1,
    unit: 'msg',
    rewardSummary: '+50 XP // Signal Wave',
  },
  {
    id: 'daily_inspect',
    type: 'daily',
    title: 'Substrate Scan',
    desc: 'Inspect or interact with active world applications in the environment.',
    xp: 120,
    target: 1,
    unit: 'scan',
    rewardSummary: '+120 XP // Matrix Shard',
  },
  {
    id: 'weekly_overdrive',
    type: 'weekly',
    title: 'Overdrive Surge',
    desc: 'Engage and execute 5 operational mission tasks during the weekly cycle.',
    xp: 350,
    target: 5,
    unit: 'tasks',
    rewardSummary: '+350 XP + Overdrive Core Badge',
    rewardItem: 'badge_overdrive',
  },
  {
    id: 'weekly_architect',
    type: 'weekly',
    title: 'Architect Blueprinting',
    desc: 'Anchor, place, or modify a virtual world entity in the simulation.',
    xp: 400,
    target: 1,
    unit: 'build',
    rewardSummary: '+400 XP + Neon Surge Skin',
    rewardItem: 'skin_neon_surge',
  },
  {
    id: 'weekly_velocity',
    type: 'weekly',
    title: 'Photon Velocity',
    desc: 'Sprint and jump through the sector terrain in high-energy motion.',
    xp: 300,
    target: 1,
    unit: 'surge',
    rewardSummary: '+300 XP + Photon Glider Wings',
    rewardItem: 'item_holo_wings',
  },
]

/**
 * Calculates current tier based on total XP
 */
export function calculateTier(xp = 0) {
  let currentTier = PROGRESSION_TIERS[0]
  for (let i = PROGRESSION_TIERS.length - 1; i >= 0; i--) {
    if (xp >= PROGRESSION_TIERS[i].requiredXp) {
      currentTier = PROGRESSION_TIERS[i]
      break
    }
  }
  const nextTierIndex = PROGRESSION_TIERS.findIndex(t => t.tier === currentTier.tier) + 1
  const nextTier = PROGRESSION_TIERS[nextTierIndex] || null

  let progressToNext = 1
  if (nextTier) {
    const range = nextTier.requiredXp - currentTier.requiredXp
    const current = xp - currentTier.requiredXp
    progressToNext = Math.min(1, Math.max(0, range > 0 ? current / range : 1))
  }

  return {
    tier: currentTier.tier,
    title: currentTier.title,
    xp,
    currentTierRequiredXp: currentTier.requiredXp,
    nextTierRequiredXp: nextTier?.requiredXp || currentTier.requiredXp,
    nextTierTitle: nextTier?.title || null,
    progressToNext,
    rewardId: currentTier.rewardId,
  }
}

/**
 * Formats full progression status for serialization
 */
export function getProgressionStatus(user = {}) {
  const xp = user.xp || 0
  const tierInfo = calculateTier(xp)

  let unlockedCosmetics = []
  if (Array.isArray(user.unlockedCosmetics)) {
    unlockedCosmetics = user.unlockedCosmetics
  } else if (typeof user.unlockedCosmetics === 'string') {
    try {
      unlockedCosmetics = JSON.parse(user.unlockedCosmetics)
    } catch {
      unlockedCosmetics = []
    }
  }

  // Ensure default base cosmetics are unlocked
  if (!unlockedCosmetics.includes('badge_initiate')) {
    unlockedCosmetics.push('badge_initiate')
  }

  let missionProgress = {}
  if (user.missionProgress && typeof user.missionProgress === 'object') {
    missionProgress = user.missionProgress
  } else if (typeof user.missionProgress === 'string') {
    try {
      missionProgress = JSON.parse(user.missionProgress)
    } catch {
      missionProgress = {}
    }
  }

  // Map missions with user completion state
  const activeMissions = MISSIONS.map(mission => {
    const prog = missionProgress[mission.id] || { progress: 0, completed: false, claimed: false }
    return {
      ...mission,
      progress: prog.progress || 0,
      completed: !!prog.completed || prog.progress >= mission.target,
      claimed: !!prog.claimed,
    }
  })

  return {
    xp,
    tier: tierInfo.tier,
    tierTitle: tierInfo.title,
    nextTierTitle: tierInfo.nextTierTitle,
    progressToNext: tierInfo.progressToNext,
    nextTierRequiredXp: tierInfo.nextTierRequiredXp,
    unlockedCosmetics,
    missions: activeMissions,
    storyline: STORYLINE,
  }
}

/**
 * Claims a mission reward and returns the updated progression state
 */
export function claimMissionReward(progression = {}, missionId) {
  const mission = MISSIONS.find(m => m.id === missionId)
  if (!mission) {
    return { success: false, reason: 'Mission not found' }
  }

  const currentMissionProgress = { ...(progression.missionProgress || {}) }
  const existing = currentMissionProgress[missionId]
  if (existing?.claimed) {
    return { success: false, reason: 'Mission already claimed' }
  }

  const currentXp = Number(progression.xp || 0)
  const newXp = currentXp + mission.xp
  const newTierInfo = calculateTier(newXp)

  const unlocked = new Set(progression.unlockedCosmetics || ['badge_initiate'])
  const missionReward = mission.rewardId || mission.rewardItem
  if (missionReward) {
    unlocked.add(missionReward)
  }
  // Check if any tiers unlocked new items
  for (const t of PROGRESSION_TIERS) {
    if (newXp >= t.requiredXp && t.rewardId) {
      unlocked.add(t.rewardId)
    }
  }

  currentMissionProgress[missionId] = {
    progress: mission.target,
    completed: true,
    claimed: true,
  }

  return {
    success: true,
    xpAdded: mission.xp,
    progression: {
      ...progression,
      xp: newXp,
      tier: newTierInfo.tier,
      tierTitle: newTierInfo.title,
      unlockedCosmetics: Array.from(unlocked),
      missionProgress: currentMissionProgress,
    },
  }
}

/**
 * High-intensity presentation text formatter
 */
export function formatHighIntensityEvent(type, payload = {}) {
  switch (type) {
    case 'xp_gain':
      return `⚡ OVERDRIVE SURGE: +${payload.amount} Core XP Harvested!`
    case 'tier_up':
      return `🔥 CRITICAL ADVANCEMENT: Ascended to ${payload.title} (Tier ${payload.tier})!`
    case 'mission_claimed':
      return `✨ MISSION COMPLETED: [${payload.title}] reward synchronized!`
    case 'cosmetic_unlocked':
      return `⭐ ARTIFACT UNLOCKED: [${payload.name}] acquired!`
    default:
      return '⚡ HYPERCORE PULSE ACTIVE'
  }
}
