import { Construction } from 'lucide-react'

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Construction className="w-10 h-10 text-gray-300 mb-4" strokeWidth={1.5} />
      <h1 className="text-sm font-semibold text-gray-900 mb-1">Binnenkort beschikbaar</h1>
      <p className="text-sm text-gray-500 max-w-sm">Deze pagina wordt momenteel gebouwd.</p>
    </div>
  )
}
