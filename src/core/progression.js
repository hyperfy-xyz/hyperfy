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

/**
 * Activities the server records for mission progress. Progress is only ever
 * advanced by the server from real gameplay events — never by a claim request.
 */
export const MissionActivities = {
  DISTANCE: 'distance', // metres travelled on foot/flying (teleports excluded)
  EMOTE: 'emote', // an emote was played (eg. /flip)
  CHAT: 'chat', // a chat message was sent
  INTERACT: 'interact', // interacted with an app in the world
  BUILD: 'build', // placed, moved, edited or removed world content (builders)
  SPRINT_JUMP: 'sprint_jump', // jumped while running
  CLAIM: 'claim', // claimed another mission reward (weekly overdrive)
}

export const MISSIONS = [
  {
    id: 'daily_explore',
    type: 'daily',
    title: 'Sector Drift',
    desc: 'Travel 150 m across the sector to stabilize spatial coordinates.',
    xp: 100,
    target: 150,
    unit: 'm',
    activity: MissionActivities.DISTANCE,
    rewardSummary: '+100 XP // Core Charge',
  },
  {
    id: 'daily_emote',
    type: 'daily',
    title: 'Resonance Pulse',
    desc: 'Perform a harmonic emote (type /flip in chat) to synchronize neural frequency.',
    xp: 75,
    target: 1,
    unit: 'emote',
    activity: MissionActivities.EMOTE,
    rewardSummary: '+75 XP // Resonance Spike',
  },
  {
    id: 'daily_chat',
    type: 'daily',
    title: 'Comms Uplink',
    desc: 'Broadcast a transmission across the sector chat stream.',
    xp: 50,
    target: 1,
    unit: 'msg',
    activity: MissionActivities.CHAT,
    rewardSummary: '+50 XP // Signal Wave',
  },
  {
    id: 'daily_inspect',
    type: 'daily',
    title: 'Substrate Scan',
    desc: 'Interact with an active world application in the environment.',
    xp: 120,
    target: 1,
    unit: 'scan',
    activity: MissionActivities.INTERACT,
    rewardSummary: '+120 XP // Matrix Shard',
  },
  {
    id: 'weekly_overdrive',
    type: 'weekly',
    title: 'Overdrive Surge',
    desc: 'Claim 5 other mission rewards during the weekly cycle.',
    xp: 350,
    target: 5,
    unit: 'claims',
    activity: MissionActivities.CLAIM,
    rewardSummary: '+350 XP + Overdrive Core Badge',
    rewardItem: 'badge_overdrive',
  },
  {
    id: 'weekly_architect',
    type: 'weekly',
    title: 'Architect Blueprinting',
    desc: 'Anchor, place, or modify a virtual world entity in the simulation (builders).',
    xp: 400,
    target: 1,
    unit: 'build',
    activity: MissionActivities.BUILD,
    rewardSummary: '+400 XP + Neon Surge Skin',
    rewardItem: 'skin_neon_surge',
  },
  {
    id: 'weekly_velocity',
    type: 'weekly',
    title: 'Photon Velocity',
    desc: 'Jump 10 times while running through the sector terrain.',
    xp: 300,
    target: 10,
    unit: 'jumps',
    activity: MissionActivities.SPRINT_JUMP,
    rewardSummary: '+300 XP + Photon Glider Wings',
    rewardItem: 'item_holo_wings',
  },
]

export const DEFAULT_UNLOCKED_COSMETICS = ['badge_initiate']

/**
 * Only skins backed by an avatar file change anything in-world today.
 * Badges and items are collectibles until they get a visual.
 */
export const canEquipCosmetic = item => item?.type === 'skin' && Boolean(item.avatarUrl)

/**
 * Safely reads a JSON column that may already be parsed
 */
export function parseJSONField(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed ?? fallback
    } catch {
      return fallback
    }
  }
  return value
}

/**
 * Daily missions reset at 00:00 UTC, weekly missions on Monday 00:00 UTC.
 * Returns the cycle key (YYYY-MM-DD of the cycle start).
 */
export function getMissionCycle(mission, now = new Date()) {
  const date = new Date(now)
  const offsetDays = mission.type === 'weekly' ? (date.getUTCDay() + 6) % 7 : 0
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offsetDays)
  return new Date(start).toISOString().slice(0, 10)
}

/**
 * Returns progress for every mission scoped to the current cycle.
 * Entries from a previous cycle (or legacy entries without a cycle) start fresh.
 */
export function normalizeMissionProgress(missionProgress = {}, now = new Date()) {
  const source = parseJSONField(missionProgress, {})
  const normalized = {}
  for (const mission of MISSIONS) {
    const cycle = getMissionCycle(mission, now)
    const existing = source?.[mission.id]
    if (existing && typeof existing === 'object' && existing.cycle === cycle) {
      const entry = {
        progress: Math.min(mission.target, Math.max(0, Number(existing.progress) || 0)),
        completed: !!existing.completed,
        claimed: !!existing.claimed,
        cycle,
      }
      if (existing.claimedAt) entry.claimedAt = existing.claimedAt
      normalized[mission.id] = entry
    } else {
      normalized[mission.id] = { progress: 0, completed: false, claimed: false, cycle }
    }
  }
  return normalized
}

/**
 * Advances every mission tracking `activity` by `amount`.
 * Returns the updated progress, whether anything changed and the missions completed by this call.
 */
export function recordMissionActivity(missionProgress, activity, amount = 1, now = new Date()) {
  const progress = normalizeMissionProgress(missionProgress, now)
  const completedNow = []
  let changed = false
  const value = Number(amount)
  if (!(value > 0)) return { missionProgress: progress, changed, completedNow }
  for (const mission of MISSIONS) {
    if (mission.activity !== activity) continue
    const entry = progress[mission.id]
    if (entry.completed) continue
    const next = Math.min(mission.target, Math.round((entry.progress + value) * 10) / 10)
    if (next !== entry.progress) {
      entry.progress = next
      changed = true
    }
    if (entry.progress >= mission.target) {
      entry.completed = true
      changed = true
      completedNow.push(mission)
    }
  }
  return { missionProgress: progress, changed, completedNow }
}

/**
 * Claims a completed mission. Pure: returns the field updates to persist.
 * Rejects missions that are unknown, already claimed this cycle, or not completed.
 */
export function claimMission(user = {}, missionId, now = new Date()) {
  const mission = MISSIONS.find(m => m.id === missionId)
  if (!mission) return { success: false, code: 404, reason: 'Mission not found' }

  let missionProgress = normalizeMissionProgress(user.missionProgress, now)
  const entry = missionProgress[missionId]
  if (entry.claimed) return { success: false, code: 400, reason: 'Mission already claimed this cycle' }
  if (!entry.completed || entry.progress < mission.target) {
    return { success: false, code: 400, reason: 'Mission not completed yet' }
  }

  entry.claimed = true
  entry.claimedAt = new Date(now).toISOString()

  // claiming counts toward the weekly overdrive mission (never toward itself)
  let completedNow = []
  if (mission.activity !== MissionActivities.CLAIM) {
    const result = recordMissionActivity(missionProgress, MissionActivities.CLAIM, 1, now)
    missionProgress = result.missionProgress
    completedNow = result.completedNow
  }

  const prevXp = Math.max(0, Number(user.xp) || 0)
  const xp = prevXp + mission.xp
  const prevTier = calculateTier(prevXp)
  const tierInfo = calculateTier(xp)

  const unlocked = new Set([...DEFAULT_UNLOCKED_COSMETICS, ...parseJSONField(user.unlockedCosmetics, [])])
  const newlyUnlocked = []
  const unlock = id => {
    if (id && !unlocked.has(id)) {
      unlocked.add(id)
      newlyUnlocked.push(id)
    }
  }
  unlock(mission.rewardItem)
  for (const tier of PROGRESSION_TIERS) {
    if (xp >= tier.requiredXp) unlock(tier.rewardId)
  }

  return {
    success: true,
    mission,
    xpAdded: mission.xp,
    tierInfo,
    tieredUp: tierInfo.tier > prevTier.tier,
    newlyUnlocked,
    completedNow,
    updates: {
      xp,
      tier: tierInfo.tier,
      unlockedCosmetics: Array.from(unlocked),
      missionProgress,
    },
  }
}

/**
 * Equips an unlocked, equippable cosmetic. Pure: returns the field updates to persist.
 */
export function equipCosmetic(user = {}, cosmeticId) {
  const item = COSMETIC_ITEMS.find(c => c.id === cosmeticId)
  if (!item) return { success: false, code: 404, reason: 'Cosmetic item not found' }
  if (!canEquipCosmetic(item)) {
    return { success: false, code: 400, reason: 'This item is a collectible and cannot be equipped yet' }
  }
  const unlocked = new Set([...DEFAULT_UNLOCKED_COSMETICS, ...parseJSONField(user.unlockedCosmetics, [])])
  if (!unlocked.has(cosmeticId)) {
    return { success: false, code: 403, reason: 'Cosmetic locked. Complete missions or advance tiers to unlock it' }
  }
  const equippedCosmetics = { ...parseJSONField(user.equippedCosmetics, {}), [item.type]: item.id }
  return { success: true, item, updates: { avatar: item.avatarUrl, equippedCosmetics } }
}

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
export function getProgressionStatus(user = {}, now = new Date()) {
  const xp = Math.max(0, Number(user.xp) || 0)
  const tierInfo = calculateTier(xp)

  const unlockedCosmetics = Array.from(
    new Set([...DEFAULT_UNLOCKED_COSMETICS, ...parseJSONField(user.unlockedCosmetics, [])])
  )
  const equippedCosmetics = parseJSONField(user.equippedCosmetics, {})
  const missionProgress = normalizeMissionProgress(user.missionProgress, now)

  const activeMissions = MISSIONS.map(mission => {
    const prog = missionProgress[mission.id]
    return {
      ...mission,
      progress: prog.progress,
      completed: prog.completed || prog.progress >= mission.target,
      claimed: prog.claimed,
      cycle: prog.cycle,
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
    equippedCosmetics,
    missions: activeMissions,
    storyline: STORYLINE,
  }
}

/**
 * Backwards-compatible wrapper around claimMission() for progression objects
 */
export function claimMissionReward(progression = {}, missionId, now = new Date()) {
  const result = claimMission(progression, missionId, now)
  if (!result.success) return { success: false, reason: result.reason }
  return {
    success: true,
    xpAdded: result.xpAdded,
    progression: {
      ...progression,
      ...result.updates,
      tierTitle: result.tierInfo.title,
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
