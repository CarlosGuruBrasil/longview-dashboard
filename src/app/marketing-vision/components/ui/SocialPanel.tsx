'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Globe, Share2 } from 'lucide-react'
import GlassCard from './GlassCard'

const TICK = '#71717a'

interface SocialData {
  facebook: { name: string; fanCount: number; followers: number }
  instagram: {
    username: string; followers: number; following: number
    mediaCount: number; newFollowers28d: number; reach28d: number
    reachDaily:    { date: string; value: number }[]
    followerDaily: { date: string; value: number }[]
  }
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`
  return String(n)
}

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const tooltipStyle = { background: '#1a1a1d', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 11 }

export default function SocialPanel() {
  const [data, setData]       = useState<SocialData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/meta/page-insights')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {[1, 2].map(i => (
        <GlassCard key={i}><div className="h-56 animate-pulse bg-white/5 rounded-xl" /></GlassCard>
      ))}
    </div>
  )

  if (!data) return null

  const ig = data.instagram
  const fb = data.facebook
  const igRatio = ig.followers > 0
    ? Math.round((ig.followers / Math.max(ig.followers, fb.fanCount)) * 100)
    : 50
  const fbRatio = fb.fanCount > 0
    ? Math.round((fb.fanCount / Math.max(ig.followers, fb.fanCount)) * 100)
    : 50

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* ── Instagram ── */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
            <Globe size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">Instagram</p>
            <p className="text-[11px] text-zinc-500">@{ig.username} · {ig.mediaCount} posts</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10 text-center">
            <p className="text-xl font-bold text-white">{ig.followers.toLocaleString('pt-BR')}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Seguidores</p>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10 text-center">
            <p className={`text-xl font-bold ${ig.newFollowers28d > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {ig.newFollowers28d > 0 ? `+${ig.newFollowers28d}` : '—'}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Novos (28d)</p>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10 text-center">
            <p className="text-xl font-bold text-sky-400">{ig.reach28d > 0 ? fmtK(ig.reach28d) : '—'}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Alcance 28d</p>
          </div>
        </div>

        {ig.reachDaily.length > 0 && (
          <>
            <p className="text-[11px] text-zinc-500 mb-1.5">Alcance diário — 28 dias</p>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={ig.reachDaily} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fill: TICK, fontSize: 10 }} interval={6}
                  tickFormatter={fmtDate} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: unknown) => [(v as number).toLocaleString('pt-BR'), 'Alcance']}
                  labelFormatter={(d: unknown) => fmtDate(d as string)} />
                <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}

        {ig.followerDaily.length > 0 && (
          <>
            <p className="text-[11px] text-zinc-500 mt-3 mb-1.5">Novos seguidores por dia</p>
            <ResponsiveContainer width="100%" height={65}>
              <LineChart data={ig.followerDaily} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fill: TICK, fontSize: 10 }} interval={6}
                  tickFormatter={fmtDate} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: unknown) => [(v as number).toLocaleString('pt-BR'), 'Novos']}
                  labelFormatter={(d: unknown) => fmtDate(d as string)} />
                <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </GlassCard>

      {/* ── Facebook ── */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600/80 shrink-0">
            <Share2 size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">Facebook</p>
            <p className="text-[11px] text-zinc-500">{fb.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white/[0.04] rounded-xl p-4 border border-white/10 text-center">
            <p className="text-3xl font-bold text-white">{fb.fanCount.toLocaleString('pt-BR')}</p>
            <p className="text-[11px] text-zinc-500 mt-1">Seguidores</p>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-4 border border-white/10 text-center">
            <p className="text-3xl font-bold text-blue-400">{fb.followers.toLocaleString('pt-BR')}</p>
            <p className="text-[11px] text-zinc-500 mt-1">Curtidas</p>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
          <p className="text-[11px] text-zinc-500 mb-3 font-medium">Instagram vs Facebook</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400 w-20 shrink-0">Instagram</span>
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-pink-500 transition-all duration-700"
                  style={{ width: `${igRatio}%` }} />
              </div>
              <span className="text-[11px] font-bold text-white w-16 text-right shrink-0">
                {ig.followers.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400 w-20 shrink-0">Facebook</span>
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${fbRatio}%` }} />
              </div>
              <span className="text-[11px] font-bold text-white w-16 text-right shrink-0">
                {fb.fanCount.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
          {ig.followers > 0 && fb.fanCount > 0 && (
            <p className="text-[11px] text-zinc-600 mt-3">
              {ig.followers > fb.fanCount
                ? `Instagram tem ${((ig.followers / fb.fanCount - 1) * 100).toFixed(0)}% mais seguidores que o Facebook`
                : `Facebook tem ${((fb.fanCount / ig.followers - 1) * 100).toFixed(0)}% mais seguidores que o Instagram`}
            </p>
          )}
        </div>
      </GlassCard>

    </div>
  )
}
