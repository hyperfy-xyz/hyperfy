import { css } from '@firebolt-dev/css'
import { useState, useEffect } from 'react'
import { ZapIcon, SparklesIcon, ChevronRightIcon, AlertTriangleIcon, TrophyIcon, XIcon } from 'lucide-react'

export function TrialBanner({ world, onOpenUpgrade, onOpenMissions }) {
  const [billing, setBilling] = useState(() => world.billing || {})
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onBilling = data => setBilling(data)
    world.on('billing', onBilling)
    return () => world.off('billing', onBilling)
  }, [world])

  if (dismissed) return null

  // Render appropriate state
  const isTrialActive = billing.isTrialActive
  const isTrialExpired = billing.isTrialExpired
  const isPaid = billing.isPaid

  return (
    <div
      className='trial-banner'
      css={css`
        position: absolute;
        top: 0.75rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 1rem;
        border-radius: 2rem;
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        transition: all 0.2s ease;
        ${isTrialExpired
          ? `
          background: rgba(40, 10, 20, 0.9);
          border: 1px solid #ff0055;
          color: #ff99bb;
        `
          : isPaid
          ? `
          background: rgba(10, 25, 40, 0.85);
          border: 1px solid #00e5ff;
          color: #00e5ff;
        `
          : isTrialActive
          ? `
          background: rgba(18, 15, 38, 0.9);
          border: 1px solid #00e5ff;
          color: #ffffff;
        `
          : `
          background: rgba(15, 14, 28, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #d0d5e5;
        `}
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.4rem;
        `}
      >
        {isTrialExpired ? (
          <AlertTriangleIcon size={16} color='#ff0055' />
        ) : isPaid ? (
          <SparklesIcon size={16} color='#00e5ff' />
        ) : (
          <ZapIcon size={16} color='#00e5ff' />
        )}

        <span>
          {isPaid
            ? 'ARCHITECT PRO // ACTIVE'
            : isTrialActive
            ? `ARCHITECT TRIAL // ${billing.trialDaysRemaining} DAYS REMAINING`
            : isTrialExpired
            ? 'TRIAL EXPIRED // UPGRADE TO HOST & BUILD'
            : 'FREE EXPLORER // MISSIONS & TRIAL AVAILABLE'}
        </span>
      </div>

      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
        `}
      >
        {onOpenMissions && (
          <button
            onClick={onOpenMissions}
            css={css`
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.2);
              color: white;
              padding: 0.25rem 0.65rem;
              border-radius: 1rem;
              font-size: 0.75rem;
              font-weight: 700;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 0.3rem;
              &:hover {
                background: rgba(255, 255, 255, 0.18);
              }
            `}
          >
            <TrophyIcon size={12} /> Missions & Lore
          </button>
        )}

        {!isPaid && onOpenUpgrade && (
          <button
            onClick={onOpenUpgrade}
            css={css`
              background: ${isTrialExpired
                ? 'linear-gradient(90deg, #ff0055, #ff007f)'
                : 'linear-gradient(90deg, #00e5ff, #7928ca)'};
              border: none;
              color: white;
              padding: 0.25rem 0.75rem;
              border-radius: 1rem;
              font-size: 0.75rem;
              font-weight: 800;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 0.25rem;
              &:hover {
                filter: brightness(1.15);
              }
            `}
          >
            {isTrialExpired ? 'Upgrade Now' : isTrialActive ? 'Upgrade' : 'View Plans'}
            <ChevronRightIcon size={12} />
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          title='Dismiss'
          css={css`
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.4);
            cursor: pointer;
            padding: 0.1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            &:hover {
              color: white;
            }
          `}
        >
          <XIcon size={14} />
        </button>
      </div>
    </div>
  )
}
