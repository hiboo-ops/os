'use client'

import { useState } from 'react'
import { CalendlyPanel } from './integrations/CalendlyPanel'
import { SlackPanel } from './integrations/SlackPanel'
import { WhopStripePanel } from './integrations/WhopStripePanel'
import { LovablePanel } from './integrations/LovablePanel'

const SUB_TABS = [
  { key: 'calendly', label: 'Calendly' },
  { key: 'slack', label: 'Slack' },
  { key: 'whop-stripe', label: 'Whop / Stripe' },
  { key: 'lovable', label: 'Lovable' },
] as const

type SubTabKey = (typeof SUB_TABS)[number]['key']

export function IntegrationsTab() {
  const [active, setActive] = useState<SubTabKey>('calendly')

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 mb-5">
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-[120ms] ${
              active === tab.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'calendly' && <CalendlyPanel />}
      {active === 'slack' && <SlackPanel />}
      {active === 'whop-stripe' && <WhopStripePanel />}
      {active === 'lovable' && <LovablePanel />}
    </div>
  )
}
