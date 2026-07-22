'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SkeletonPage } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { eur } from '@/lib/format'
import {
  Users, Search, ChevronLeft, ChevronRight,
} from 'lucide-react'

const iconProps = { strokeWidth: 1.75 } as const

interface AccountRow {
  id: string
  name: string
  email: string | null
  status: string
  ltv: number
  open_amount: number
  source: string | null
  creator: { id: string; name: string } | null
  setter: { id: string; name: string } | null
  closer: { id: string; name: string } | null
  created_at: string
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const pageSize = 50

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (search) params.set('search', search)

    const res = await fetch(`/api/accounts?${params}`)
    const data = await res.json()
    setAccounts(data.accounts || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const totalPages = Math.ceil(total / pageSize)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  if (loading && page === 1) return <SkeletonPage />

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} accounts</p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" {...iconProps} />
            <input
              type="text"
              placeholder="Zoek op naam of email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent-500 w-64"
            />
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1.2fr_1.2fr_90px_100px_110px_110px_100px] gap-4 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          <div>Naam</div>
          <div>Email</div>
          <div>Status</div>
          <div className="text-right">LTV</div>
          <div className="text-right">Openstaand</div>
          <div>Closer</div>
          <div>Source</div>
        </div>

        {accounts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" {...iconProps} />
            <p className="text-sm text-gray-400">
              {search ? 'Geen resultaten' : 'Nog geen accounts'}
            </p>
          </div>
        ) : (
          accounts.map((acc) => (
            <Link
              key={acc.id}
              href={`/finance/accounts/${acc.id}`}
              className="grid grid-cols-[1.2fr_1.2fr_90px_100px_110px_110px_100px] gap-4 px-5 py-3.5 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors duration-[120ms]"
            >
              <div className="text-sm font-medium text-gray-900 truncate">{acc.name}</div>
              <div className="text-sm text-gray-500 truncate">{acc.email || '—'}</div>
              <div><Badge status={acc.status} /></div>
              <div className="text-sm text-right tabular-nums font-medium text-gray-900">
                {eur(acc.ltv)}
              </div>
              <div className={`text-sm text-right tabular-nums font-medium ${acc.open_amount > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                {acc.open_amount > 0 ? eur(acc.open_amount) : '—'}
              </div>
              <div className="text-sm text-gray-700 truncate">{acc.closer?.name || '—'}</div>
              <div>{acc.source ? <Badge status={acc.source} /> : <span className="text-xs text-gray-300">—</span>}</div>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Pagina {page} van {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" {...iconProps} />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" {...iconProps} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
