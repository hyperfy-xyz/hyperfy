import { css } from '@firebolt-dev/css'
import { useState, useEffect } from 'react'
import {
  TrophyIcon,
  BookOpenIcon,
  ZapIcon,
  SparklesIcon,
  CheckCircle2Icon,
  LockIcon,
  ShieldIcon,
  CrownIcon,
  FlameIcon,
  CompassIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { COSMETIC_ITEMS, MISSIONS, STORYLINE, calculateTier } from '../../core/progression'

export function MissionsPane({ world, hidden, onOpenUpgrade }) {
  const [activeTab, setActiveTab] = useState('missions') // 'missions' | 'storyline'
  const [progression, setProgression] = useState(() => world.progression || {})
  const [billing, setBilling] = useState(() => world.billing || {})

  useEffect(() => {
    const onProg = data => setProgression(data)
    const onBill = data => setBilling(data)
    world.on('progression', onProg)
    world.on('billing', onBill)
    return () => {
      world.off('progression', onProg)
      world.off('billing', onBill)
    }
  }, [world])

  const xp = progression.xp || 0
  const tierInfo = calculateTier(xp)
  const missions = progression.missions || MISSIONS.map(m => ({ ...m, progress: 0, completed: false, claimed: false }))
  const unlocked = progression.unlockedCosmetics || ['badge_initiate']

  const handleClaim = missionId => {
    world.network.send('claimMission', missionId)
  }

  const handleEquip = cosmeticId => {
    world.network.send('equipCosmetic', cosmeticId)
  }

  return (
    <div
      className='missions-pane'
      css={css`
        width: 25rem;
        max-width: calc(100vw - 4rem);
        background: rgba(11, 10, 21, 0.95);
        border: 1px solid rgba(0, 229, 255, 0.3);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 229, 255, 0.1);
        backdrop-filter: blur(12px);
        border-radius: 1rem;
        display: ${hidden ? 'none' : 'flex'};
        flex-direction: column;
        overflow: hidden;
        color: white;
        pointer-events: auto;
      `}
    >
      {/* Header */}
      <div
        css={css`
          padding: 1.25rem 1.25rem 0.75rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(0, 229, 255, 0.08) 0%, transparent 100%);
        `}
      >
        <div
          css={css`
            font-size: 0.7rem;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #00e5ff;
            margin-bottom: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.35rem;
          `}
        >
          <ZapIcon size={12} /> HyperCore Overdrive
        </div>
        <h2
          css={css`
            font-size: 1.35rem;
            font-weight: 800;
            margin: 0 0 0.75rem 0;
            letter-spacing: 0.03em;
          `}
        >
          PROGRESSION & LORE
        </h2>

        {/* Tab switchers */}
        <div
          css={css`
            display: flex;
            gap: 0.5rem;
            background: rgba(0, 0, 0, 0.4);
            padding: 0.25rem;
            border-radius: 0.5rem;
          `}
        >
          <button
            onClick={() => setActiveTab('missions')}
            css={css`
              flex: 1;
              padding: 0.4rem 0.75rem;
              border: none;
              border-radius: 0.35rem;
              font-size: 0.75rem;
              font-weight: 700;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.35rem;
              transition: all 0.15s ease;
              background: ${activeTab === 'missions' ? '#00e5ff' : 'transparent'};
              color: ${activeTab === 'missions' ? '#000000' : '#8f96a3'};
            `}
          >
            <TrophyIcon size={13} /> Missions & Grind
          </button>
          <button
            onClick={() => setActiveTab('storyline')}
            css={css`
              flex: 1;
              padding: 0.4rem 0.75rem;
              border: none;
              border-radius: 0.35rem;
              font-size: 0.75rem;
              font-weight: 700;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.35rem;
              transition: all 0.15s ease;
              background: ${activeTab === 'storyline' ? '#ff007f' : 'transparent'};
              color: ${activeTab === 'storyline' ? '#ffffff' : '#8f96a3'};
            `}
          >
            <BookOpenIcon size={13} /> Storyline & Intro
          </button>
        </div>
      </div>

      {/* Content scroll area */}
      <div
        css={css`
          padding: 1.25rem;
          overflow-y: auto;
          max-height: calc(80vh - 10rem);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        `}
      >
        {activeTab === 'missions' && (
          <>
            {/* Level & XP Overview */}
            <div
              css={css`
                background: linear-gradient(135deg, rgba(0, 229, 255, 0.1) 0%, rgba(121, 40, 202, 0.1) 100%);
                border: 1px solid rgba(0, 229, 255, 0.25);
                border-radius: 0.75rem;
                padding: 1rem;
              `}
            >
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 0.5rem;
                `}
              >
                <div>
                  <div
                    css={css`
                      font-size: 0.7rem;
                      text-transform: uppercase;
                      color: #00e5ff;
                      font-weight: 800;
                    `}
                  >
                    Operative Rank
                  </div>
                  <div
                    css={css`
                      font-size: 1.1rem;
                      font-weight: 800;
                    `}
                  >
                    Tier {tierInfo.tier}: {tierInfo.title}
                  </div>
                </div>
                <div
                  css={css`
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #ffd700;
                  `}
                >
                  {xp} <span css={css`font-size: 0.75rem; color: #8f96a3;`}>XP</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div
                css={css`
                  width: 100%;
                  height: 0.6rem;
                  background: rgba(0, 0, 0, 0.5);
                  border-radius: 1rem;
                  overflow: hidden;
                  margin-bottom: 0.35rem;
                  border: 1px solid rgba(255, 255, 255, 0.1);
                `}
              >
                <div
                  css={css`
                    height: 100%;
                    width: ${Math.round(tierInfo.progressToNext * 100)}%;
                    background: linear-gradient(90deg, #00e5ff, #ff007f);
                    box-shadow: 0 0 10px #00e5ff;
                    transition: width 0.3s ease;
                  `}
                />
              </div>
              <div
                css={css`
                  font-size: 0.7rem;
                  color: #8f96a3;
                  display: flex;
                  justify-content: space-between;
                `}
              >
                <span>{Math.round(tierInfo.progressToNext * 100)}% to Next Tier</span>
                <span>Next: {tierInfo.nextTierTitle || 'Apex Mastery'}</span>
              </div>
            </div>

            {/* Daily Missions */}
            <div>
              <div
                css={css`
                  font-size: 0.8rem;
                  font-weight: 800;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  color: #00e5ff;
                  margin-bottom: 0.75rem;
                  display: flex;
                  align-items: center;
                  gap: 0.4rem;
                `}
              >
                <FlameIcon size={14} /> Daily Pulse Missions
              </div>
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.6rem;
                `}
              >
                {missions
                  .filter(m => m.type === 'daily')
                  .map(mission => (
                    <MissionCard key={mission.id} mission={mission} onClaim={() => handleClaim(mission.id)} />
                  ))}
              </div>
            </div>

            {/* Weekly Missions */}
            <div>
              <div
                css={css`
                  font-size: 0.8rem;
                  font-weight: 800;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  color: #ff007f;
                  margin-bottom: 0.75rem;
                  display: flex;
                  align-items: center;
                  gap: 0.4rem;
                `}
              >
                <ZapIcon size={14} /> Weekly Overdrive Operations
              </div>
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: 0.6rem;
                `}
              >
                {missions
                  .filter(m => m.type === 'weekly')
                  .map(mission => (
                    <MissionCard key={mission.id} mission={mission} onClaim={() => handleClaim(mission.id)} />
                  ))}
              </div>
            </div>

            {/* Cosmetics & Unlocks */}
            <div>
              <div
                css={css`
                  font-size: 0.8rem;
                  font-weight: 800;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  color: #ffd700;
                  margin-bottom: 0.75rem;
                  display: flex;
                  align-items: center;
                  gap: 0.4rem;
                `}
              >
                <SparklesIcon size={14} /> Cosmetic & Skin Synthesis
              </div>
              <div
                css={css`
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
                  gap: 0.6rem;
                `}
              >
                {COSMETIC_ITEMS.map(item => {
                  const isUnlocked = unlocked.includes(item.id)
                  return (
                    <div
                      key={item.id}
                      css={css`
                        background: ${isUnlocked ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.3)'};
                        border: 1px solid ${isUnlocked ? item.color : 'rgba(255, 255, 255, 0.1)'};
                        border-radius: 0.5rem;
                        padding: 0.75rem;
                        display: flex;
                        flex-direction: column;
                        gap: 0.35rem;
                        position: relative;
                      `}
                    >
                      <div
                        css={css`
                          display: flex;
                          justify-content: space-between;
                          align-items: center;
                        `}
                      >
                        <span
                          css={css`
                            font-size: 0.65rem;
                            text-transform: uppercase;
                            color: ${item.color};
                            font-weight: 800;
                          `}
                        >
                          {item.rarity} // {item.type}
                        </span>
                        {isUnlocked ? (
                          <CheckCircle2Icon size={14} color='#00e5ff' />
                        ) : (
                          <LockIcon size={14} color='#8f96a3' />
                        )}
                      </div>
                      <div
                        css={css`
                          font-size: 0.85rem;
                          font-weight: 700;
                        `}
                      >
                        {item.name}
                      </div>
                      <div
                        css={css`
                          font-size: 0.7rem;
                          color: #a0a5ba;
                          line-height: 1.3;
                          flex-grow: 1;
                        `}
                      >
                        {item.desc}
                      </div>
                      {isUnlocked && (
                        <button
                          onClick={() => handleEquip(item.id)}
                          css={css`
                            margin-top: 0.35rem;
                            background: rgba(0, 229, 255, 0.15);
                            border: 1px solid #00e5ff;
                            color: #00e5ff;
                            border-radius: 0.35rem;
                            padding: 0.3rem 0.5rem;
                            font-size: 0.7rem;
                            font-weight: 700;
                            cursor: pointer;
                            &:hover {
                              background: rgba(0, 229, 255, 0.3);
                            }
                          `}
                        >
                          Equip
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'storyline' && (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: 1.25rem;
            `}
          >
            {/* Storyline Banner */}
            <div
              css={css`
                background: linear-gradient(135deg, rgba(255, 0, 127, 0.15) 0%, rgba(0, 229, 255, 0.15) 100%);
                border: 1px solid rgba(255, 0, 127, 0.4);
                border-radius: 0.75rem;
                padding: 1.25rem;
              `}
            >
              <div
                css={css`
                  font-size: 0.7rem;
                  font-weight: 800;
                  color: #00e5ff;
                  letter-spacing: 0.1em;
                  text-transform: uppercase;
                  margin-bottom: 0.35rem;
                `}
              >
                Lore Dossier
              </div>
              <h3
                css={css`
                  font-size: 1.2rem;
                  font-weight: 800;
                  margin: 0 0 0.5rem 0;
                  color: #ffffff;
                `}
              >
                {STORYLINE.title}
              </h3>
              <p
                css={css`
                  font-size: 0.85rem;
                  color: #e0e5f5;
                  line-height: 1.45;
                  margin: 0;
                  font-style: italic;
                `}
              >
                "{STORYLINE.tagline}"
              </p>
            </div>

            {/* Intro Narrative */}
            <div
              css={css`
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 0.75rem;
                padding: 1rem;
              `}
            >
              <div
                css={css`
                  font-size: 0.75rem;
                  font-weight: 800;
                  color: #ffd700;
                  text-transform: uppercase;
                  margin-bottom: 0.5rem;
                `}
              >
                What is Hyperfy?
              </div>
              <p
                css={css`
                  font-size: 0.85rem;
                  color: #c0c5d5;
                  line-height: 1.5;
                  margin: 0;
                `}
              >
                {STORYLINE.intro}
              </p>
            </div>

            {/* Chapters */}
            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
              `}
            >
              {STORYLINE.chapters.map(chapter => (
                <div
                  key={chapter.id}
                  css={css`
                    background: rgba(255, 255, 255, 0.02);
                    border-left: 3px solid #00e5ff;
                    padding: 0.85rem 1rem;
                    border-radius: 0 0.5rem 0.5rem 0;
                  `}
                >
                  <div
                    css={css`
                      font-size: 0.85rem;
                      font-weight: 800;
                      color: #00e5ff;
                      margin-bottom: 0.35rem;
                    `}
                  >
                    {chapter.title}
                  </div>
                  <div
                    css={css`
                      font-size: 0.8rem;
                      color: #a0a5ba;
                      line-height: 1.4;
                    `}
                  >
                    {chapter.summary}
                  </div>
                </div>
              ))}
            </div>

            {/* Call to action */}
            <div
              css={css`
                text-align: center;
                padding: 1rem;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 0.75rem;
                border: 1px dashed rgba(255, 255, 255, 0.15);
              `}
            >
              <div
                css={css`
                  font-size: 0.85rem;
                  font-weight: 700;
                  margin-bottom: 0.5rem;
                `}
              >
                Ready to anchor your own sector?
              </div>
              <button
                onClick={onOpenUpgrade}
                css={css`
                  background: linear-gradient(90deg, #00e5ff, #ff007f);
                  border: none;
                  color: white;
                  font-weight: 800;
                  font-size: 0.8rem;
                  padding: 0.5rem 1rem;
                  border-radius: 2rem;
                  cursor: pointer;
                  &:hover {
                    filter: brightness(1.15);
                  }
                `}
              >
                View Architect Plans & Trial
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MissionCard({ mission, onClaim }) {
  const isReady = mission.completed && !mission.claimed
  return (
    <div
      css={css`
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid ${isReady ? '#00e5ff' : 'rgba(255, 255, 255, 0.08)'};
        border-radius: 0.5rem;
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        box-shadow: ${isReady ? '0 0 15px rgba(0, 229, 255, 0.2)' : 'none'};
      `}
    >
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        `}
      >
        <div>
          <div
            css={css`
              font-size: 0.85rem;
              font-weight: 700;
            `}
          >
            {mission.title}
          </div>
          <div
            css={css`
              font-size: 0.7rem;
              color: #a0a5ba;
              line-height: 1.3;
            `}
          >
            {mission.desc}
          </div>
        </div>
        <div
          css={css`
            background: rgba(255, 215, 0, 0.15);
            color: #ffd700;
            border: 1px solid rgba(255, 215, 0, 0.3);
            padding: 0.2rem 0.45rem;
            border-radius: 0.35rem;
            font-size: 0.7rem;
            font-weight: 800;
            white-space: nowrap;
          `}
        >
          +{mission.xp} XP
        </div>
      </div>

      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 0.25rem;
        `}
      >
        <div
          css={css`
            font-size: 0.7rem;
            color: #8f96a3;
          `}
        >
          {mission.rewardSummary}
        </div>

        {mission.claimed ? (
          <span
            css={css`
              font-size: 0.7rem;
              color: #8f96a3;
              font-weight: 700;
            `}
          >
            Claimed ✓
          </span>
        ) : isReady ? (
          <button
            onClick={onClaim}
            css={css`
              background: linear-gradient(90deg, #00e5ff, #ff007f);
              border: none;
              color: #000000;
              font-weight: 800;
              padding: 0.3rem 0.75rem;
              border-radius: 0.35rem;
              font-size: 0.75rem;
              cursor: pointer;
              box-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
              &:hover {
                filter: brightness(1.2);
              }
            `}
          >
            CLAIM REWARD
          </button>
        ) : (
          <button
            onClick={onClaim}
            css={css`
              background: rgba(0, 229, 255, 0.15);
              border: 1px solid #00e5ff;
              color: #00e5ff;
              font-weight: 700;
              padding: 0.25rem 0.6rem;
              border-radius: 0.35rem;
              font-size: 0.7rem;
              cursor: pointer;
              &:hover {
                background: rgba(0, 229, 255, 0.3);
              }
            `}
          >
            Claim (Grind)
          </button>
        )}
      </div>
    </div>
  )
}
