'use client'

import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'
import { IntegrationsTab } from './_components/IntegrationsTab'
import { TeamTab } from './_components/TeamTab'
import { ApiCallsTab } from './_components/ApiCallsTab'

const TABS = [
  { key: 'integrations', label: 'Integrations' },
  { key: 'team', label: 'Team' },
  { key: 'api-calls', label: 'API Calls' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('integrations')
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => { setRole(data?.role ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonPage />

  if (role !== 'ADMIN') {
    return (
      <div className="max-w-4xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Admin</h1>
        <p className="text-sm text-gray-500">Alleen admins hebben toegang tot deze pagina.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Integrations, team & monitoring</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-100">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2 text-sm font-medium -mb-px border-b-2 transition-colors duration-[120ms] ${
              activeTab === tab.key
                ? 'border-accent-700 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'integrations' && <IntegrationsTab />}
      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'api-calls' && <ApiCallsTab />}
    </div>
  )
}
