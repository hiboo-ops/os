'use client'

import { Activity } from 'lucide-react'

export function ApiCallsTab() {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center">
      <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
      <h3 className="text-sm font-semibold text-gray-900 mb-1">API Calls</h3>
      <p className="text-sm text-gray-500">
        Komt in Fase 2 — monitoring van alle API-calls en webhooks.
      </p>
    </div>
  )
}
