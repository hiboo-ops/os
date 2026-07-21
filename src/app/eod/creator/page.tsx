'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, Plus, Trash2 } from 'lucide-react'

interface Post {
  link: string
  type: 'TOF' | 'MOF' | 'BOF' | ''
  waarom: string
}

const STORY_TYPES = [
  'Educational',
  'Q&A',
  'Lifestyle',
  'Credibility',
  'Day in the life',
  'Launch',
] as const

function emptyPost(): Post {
  return { link: '', type: '', waarom: '' }
}

export default function CreatorEodPage() {
  const [userName, setUserName] = useState('')
  const [teamMemberId, setTeamMemberId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  // TikTok
  const [tiktokPosts, setTiktokPosts] = useState<Post[]>([emptyPost()])

  // Instagram Main Feed
  const [igPosts, setIgPosts] = useState<Post[]>([emptyPost()])

  // Instagram Stories
  const [storyPosted, setStoryPosted] = useState<'ja' | 'nee' | ''>('')
  const [storyTypes, setStoryTypes] = useState<string[]>([])
  const [storyWaarom, setStoryWaarom] = useState('')

  // Reflectie
  const [watGingGoed, setWatGingGoed] = useState('')
  const [hulpNodig, setHulpNodig] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => {
        if (data.name) setUserName(data.name)
        if (data.teamMemberId) setTeamMemberId(data.teamMemberId)
      })
      .catch(() => {})
  }, [])

  const updatePost = (list: Post[], setList: (p: Post[]) => void, idx: number, field: keyof Post, value: string) => {
    const updated = [...list]
    updated[idx] = { ...updated[idx], [field]: value }
    setList(updated)
  }

  const addPost = (list: Post[], setList: (p: Post[]) => void) => {
    setList([...list, emptyPost()])
  }

  const removePost = (list: Post[], setList: (p: Post[]) => void, idx: number) => {
    if (list.length <= 1) return
    setList(list.filter((_, i) => i !== idx))
  }

  const toggleStoryType = (type: string) => {
    setStoryTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const handleSubmit = async () => {
    if (!teamMemberId) {
      setError('Gebruiker niet gevonden. Herlaad de pagina.')
      return
    }

    setSaving(true)
    setError('')
    setSaved(false)

    const answers = {
      tiktok: {
        aantal_posts: tiktokPosts.length,
        posts: tiktokPosts.map((p, i) => ({
          nr: i + 1,
          link: p.link,
          type: p.type,
          waarom: p.waarom,
        })),
      },
      instagram_main: {
        aantal_posts: igPosts.length,
        posts: igPosts.map((p, i) => ({
          nr: i + 1,
          link: p.link,
          type: p.type,
          waarom: p.waarom,
        })),
      },
      instagram_stories: {
        story_gepost: storyPosted,
        soort_sequence: storyTypes,
        waarom: storyWaarom,
      },
      reflectie: {
        wat_ging_goed: watGingGoed,
        hulp_nodig: hulpNodig,
      },
    }

    const { error: dbError } = await supabase
      .from('eod_reports')
      .upsert(
        {
          report_date: date,
          role_type: 'CREATOR',
          team_member_id: teamMemberId,
          submitted_name: userName,
          answers,
        },
        { onConflict: 'team_member_id,role_type,report_date' }
      )

    setSaving(false)
    if (dbError) {
      setError('Opslaan mislukt: ' + dbError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const renderPostSection = (
    title: string,
    posts: Post[],
    setPosts: (p: Post[]) => void,
  ) => (
    <section className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>
      <div className="mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Aantal posts vandaag: {posts.length}
        </span>
      </div>
      <div className="space-y-4">
        {posts.map((post, idx) => (
          <div key={idx} className="bg-gray-50 rounded-lg p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500">Post {idx + 1}</span>
              {posts.length > 1 && (
                <button
                  onClick={() => removePost(posts, setPosts, idx)}
                  className="text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Link / beschrijving</label>
                <input
                  type="text"
                  value={post.link}
                  onChange={e => updatePost(posts, setPosts, idx, 'link', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="URL of korte beschrijving..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Type</label>
                <div className="flex gap-3">
                  {(['TOF', 'MOF', 'BOF'] as const).map(t => (
                    <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name={`${title}-type-${idx}`}
                        checked={post.type === t}
                        onChange={() => updatePost(posts, setPosts, idx, 'type', t)}
                        className="accent-accent-600"
                      />
                      <span className="text-sm text-gray-700">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Waarom deze keuze?</label>
                <textarea
                  value={post.waarom}
                  onChange={e => updatePost(posts, setPosts, idx, 'waarom', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="Leg uit waarom je dit type hebt gekozen..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => addPost(posts, setPosts)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent-600 hover:text-accent-700 font-medium"
      >
        <Plus className="w-4 h-4" /> Post toevoegen
      </button>
    </section>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">EOD Creator (Content)</h1>
        <p className="text-sm text-gray-500 mt-1">Dagelijkse rapportage content & social media</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Datum</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Naam</label>
              <input
                type="text"
                value={userName}
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
          </div>
        </section>

        {/* TikTok */}
        {renderPostSection('TikTok', tiktokPosts, setTiktokPosts)}

        {/* Instagram Main Feed */}
        {renderPostSection('Instagram Main Feed', igPosts, setIgPosts)}

        {/* Instagram Stories */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Instagram Stories</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Story gepost?</label>
              <div className="flex gap-4">
                {(['ja', 'nee'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="story-posted"
                      checked={storyPosted === opt}
                      onChange={() => setStoryPosted(opt)}
                      className="accent-accent-600"
                    />
                    <span className="text-sm text-gray-700 capitalize">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {storyPosted === 'ja' && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Soort sequence (meerdere mogelijk)</label>
                  <div className="flex flex-wrap gap-2">
                    {STORY_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => toggleStoryType(type)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                          storyTypes.includes(type)
                            ? 'bg-accent-600 text-white border-accent-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Uitleg waarom</label>
                  <textarea
                    value={storyWaarom}
                    onChange={e => setStoryWaarom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Waarom deze sequence keuze..."
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* Reflectie */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Reflectie</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Wat ging goed?</label>
              <textarea
                value={watGingGoed}
                onChange={e => setWatGingGoed(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Beschrijf wat er goed ging vandaag..."
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Waar hulp bij nodig?</label>
              <textarea
                value={hulpNodig}
                onChange={e => setHulpNodig(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Waar kun je hulp bij gebruiken..."
              />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Opgeslagen
            </span>
          )}
          {error && (
            <span className="text-sm text-red-600">{error}</span>
          )}
        </div>
      </div>
    </div>
  )
}
