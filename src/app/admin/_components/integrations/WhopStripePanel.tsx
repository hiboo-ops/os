'use client'

import { CreditCard } from 'lucide-react'

export function WhopStripePanel() {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-200 p-8 text-center">
      <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Whop & Stripe</h3>
      <p className="text-sm text-gray-500">
        Komt binnenkort — hier kun je product-mappings en payment-integraties beheren.
      </p>
    </div>
  )
}
