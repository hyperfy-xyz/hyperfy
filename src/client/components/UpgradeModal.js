import { css } from '@firebolt-dev/css'
import { useState, useEffect } from 'react'
import { SparklesIcon, CheckIcon, XIcon, ZapIcon, GlobeIcon, CrownIcon, ShieldCheckIcon } from 'lucide-react'

export function UpgradeModal({ world, onClose }) {
  const [billing, setBilling] = useState(() => world.billing || {})
  const [upgraded, setUpgraded] = useState(false)

  useEffect(() => {
    const onBilling = data => {
      setBilling(data)
      if (data?.isPaid) setUpgraded(true)
    }
    world.on('billing', onBilling)
    return () => world.off('billing', onBilling)
  }, [world])

  const handleUpgrade = () => {
    world.network.send('billingUpgrade', { plan: 'architect_pro' })
    setUpgraded(true)
  }

  const handleStartTrial = () => {
    world.network.send('startTrial')
  }

  return (
    <div
      className='upgrade-modal-overlay'
      css={css`
        position: fixed;
        inset: 0;
        background: rgba(5, 5, 12, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1.5rem;
      `}
    >
      <div
        className='upgrade-modal-content'
        css={css`
          background: linear-gradient(135deg, #0e0d1c 0%, #17152b 100%);
          border: 1px solid rgba(0, 229, 255, 0.4);
          box-shadow: 0 0 35px rgba(0, 229, 255, 0.2), inset 0 0 20px rgba(0, 229, 255, 0.05);
          border-radius: 1rem;
          max-width: 52rem;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          color: white;
          padding: 2rem;
          position: relative;
        `}
      >
        <button
          onClick={onClose}
          css={css`
            position: absolute;
            top: 1.25rem;
            right: 1.25rem;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 0.5rem;
            width: 2.25rem;
            height: 2.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            &:hover {
              background: rgba(255, 255, 255, 0.2);
            }
          `}
        >
          <XIcon size={18} />
        </button>

        <div
          css={css`
            text-align: center;
            margin-bottom: 2rem;
          `}
        >
          <div
            css={css`
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 0.75rem;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              color: #00e5ff;
              font-weight: 700;
              background: rgba(0, 229, 255, 0.1);
              padding: 0.35rem 0.85rem;
              border-radius: 2rem;
              border: 1px solid rgba(0, 229, 255, 0.3);
              margin-bottom: 0.75rem;
            `}
          >
            <ZapIcon size={14} /> HyperCore Metaverse Architecture
          </div>
          <h2
            css={css`
              font-size: 2rem;
              font-weight: 800;
              letter-spacing: 0.05em;
              margin: 0 0 0.5rem 0;
              background: linear-gradient(90deg, #ffffff, #00e5ff, #ff007f);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            `}
          >
            ARCHITECT LICENSING & TIERS
          </h2>
          <p
            css={css`
              color: #a0a5ba;
              font-size: 0.95rem;
              margin: 0;
            `}
          >
            Explore freely across public sectors. Elevate to Architect Pro to host persistent worlds.
          </p>
        </div>

        {upgraded && (
          <div
            css={css`
              background: rgba(0, 229, 255, 0.15);
              border: 1px solid #00e5ff;
              padding: 1rem;
              border-radius: 0.75rem;
              text-align: center;
              margin-bottom: 1.5rem;
              color: #00e5ff;
              font-weight: 700;
            `}
          >
            ✨ ARCHITECT PRO ACTIVATED! Your world hosting and builder permissions are unlocked.
          </div>
        )}

        <div
          css={css`
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
            gap: 1.25rem;
            margin-bottom: 2rem;
          `}
        >
          {/* Free Explorer */}
          <div
            css={css`
              background: rgba(255, 255, 255, 0.03);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 0.75rem;
              padding: 1.5rem;
              display: flex;
              flex-direction: column;
            `}
          >
            <div
              css={css`
                color: #00e5ff;
                margin-bottom: 0.5rem;
              `}
            >
              <GlobeIcon size={24} />
            </div>
            <h3
              css={css`
                font-size: 1.25rem;
                margin: 0 0 0.25rem 0;
              `}
            >
              Free Explorer
            </h3>
            <div
              css={css`
                font-size: 1.5rem;
                font-weight: 800;
                margin-bottom: 1rem;
              `}
            >
              $0{' '}
              <span
                css={css`
                  font-size: 0.85rem;
                  color: #8f96a3;
                  font-weight: 400;
                `}
              >
                / forever
              </span>
            </div>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0 0 1.5rem 0;
                flex-grow: 1;
                font-size: 0.85rem;
                color: #c0c5d0;
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
              `}
            >
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#00e5ff' /> Unrestricted public sector access
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#00e5ff' /> Multiplayer voice & spatial audio
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#00e5ff' /> Daily & weekly mission grinding
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#00e5ff' /> Unlock cosmetics, items & badges
              </li>
            </ul>
            <div
              css={css`
                font-size: 0.8rem;
                color: #8f96a3;
                text-align: center;
                padding: 0.6rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 0.5rem;
              `}
            >
              Active Clearance
            </div>
          </div>

          {/* 14-Day Trial */}
          <div
            css={css`
              background: rgba(0, 229, 255, 0.04);
              border: 1px solid rgba(0, 229, 255, 0.3);
              border-radius: 0.75rem;
              padding: 1.5rem;
              display: flex;
              flex-direction: column;
            `}
          >
            <div
              css={css`
                color: #ffd700;
                margin-bottom: 0.5rem;
              `}
            >
              <SparklesIcon size={24} />
            </div>
            <h3
              css={css`
                font-size: 1.25rem;
                margin: 0 0 0.25rem 0;
              `}
            >
              Architect Trial
            </h3>
            <div
              css={css`
                font-size: 1.5rem;
                font-weight: 800;
                margin-bottom: 1rem;
              `}
            >
              14 Days Free
            </div>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0 0 1.5rem 0;
                flex-grow: 1;
                font-size: 0.85rem;
                color: #c0c5d0;
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
              `}
            >
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#00e5ff' /> Anchor & host a persistent sector
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#00e5ff' /> Full builder mode & scripting
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#00e5ff' /> Custom 3D asset & app uploads
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#00e5ff' /> Invite collaborators & visitors
              </li>
            </ul>
            {billing.isTrialActive ? (
              <div
                css={css`
                  font-size: 0.8rem;
                  color: #00e5ff;
                  font-weight: 700;
                  text-align: center;
                  padding: 0.6rem;
                  background: rgba(0, 229, 255, 0.1);
                  border-radius: 0.5rem;
                `}
              >
                {billing.trialDaysRemaining} Days Remaining
              </div>
            ) : (
              <button
                onClick={handleStartTrial}
                disabled={billing.trialStartedAt}
                css={css`
                  background: rgba(0, 229, 255, 0.2);
                  border: 1px solid #00e5ff;
                  color: #00e5ff;
                  padding: 0.65rem 1rem;
                  border-radius: 0.5rem;
                  font-weight: 700;
                  font-size: 0.85rem;
                  cursor: pointer;
                  &:hover {
                    background: rgba(0, 229, 255, 0.35);
                  }
                  &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                  }
                `}
              >
                {billing.trialStartedAt ? 'Trial Concluded' : 'Start 14-Day Trial'}
              </button>
            )}
          </div>

          {/* Architect Pro */}
          <div
            css={css`
              background: linear-gradient(180deg, rgba(255, 0, 127, 0.1) 0%, rgba(121, 40, 202, 0.15) 100%);
              border: 1px solid #ff007f;
              border-radius: 0.75rem;
              padding: 1.5rem;
              display: flex;
              flex-direction: column;
              box-shadow: 0 0 20px rgba(255, 0, 127, 0.2);
            `}
          >
            <div
              css={css`
                color: #ff007f;
                margin-bottom: 0.5rem;
              `}
            >
              <CrownIcon size={24} />
            </div>
            <h3
              css={css`
                font-size: 1.25rem;
                margin: 0 0 0.25rem 0;
              `}
            >
              Architect Pro
            </h3>
            <div
              css={css`
                font-size: 1.5rem;
                font-weight: 800;
                margin-bottom: 1rem;
              `}
            >
              $15{' '}
              <span
                css={css`
                  font-size: 0.85rem;
                  color: #8f96a3;
                  font-weight: 400;
                `}
              >
                / month
              </span>
            </div>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0 0 1.5rem 0;
                flex-grow: 1;
                font-size: 0.85rem;
                color: #c0c5d0;
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
              `}
            >
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#ff007f' /> Unlimited persistent sector hosting
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#ff007f' /> Priority physics & tick rate
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#ff007f' /> Custom domain & privacy controls
              </li>
              <li
                css={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <CheckIcon size={16} color='#ff007f' /> Exclusive Apex Architect cosmetics
              </li>
            </ul>
            <button
              onClick={handleUpgrade}
              css={css`
                background: linear-gradient(90deg, #ff007f, #7928ca);
                border: none;
                color: white;
                padding: 0.75rem 1.25rem;
                border-radius: 0.5rem;
                font-weight: 800;
                font-size: 0.9rem;
                letter-spacing: 0.05em;
                cursor: pointer;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
                &:hover {
                  transform: translateY(-1px);
                  box-shadow: 0 0 15px rgba(255, 0, 127, 0.4);
                }
              `}
            >
              {billing.isPaid ? 'Active Subscription' : 'ACTIVATE ARCHITECT PRO'}
            </button>
          </div>
        </div>

        <div
          css={css`
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 1.25rem;
          `}
        >
          <button
            onClick={onClose}
            css={css`
              background: transparent;
              border: none;
              color: #8f96a3;
              cursor: pointer;
              font-size: 0.85rem;
              &:hover {
                color: white;
              }
            `}
          >
            Close and return to exploration
          </button>
        </div>
      </div>
    </div>
  )
}
