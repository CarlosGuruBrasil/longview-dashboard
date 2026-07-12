'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Building2, CheckCircle2, RefreshCw, Tags } from 'lucide-react'
import logger from '@/lib/logger'

type Scope = { id: 'longview' | 'nautic' | 'hub-beira-mar'; nome: string; tipo: string }
type Item = {
  id: number; code: string | null; modelo: string | null; obra: string | null
  local: string | null; status: string | null; data: string | null
  source_modelo: string | null; source_obra: string | null; source_local: string | null
  override_modelo: string | null; override_obra: string | null; override_local: string | null
  scope_ids: string[]; manual: boolean
}
type ClassificationData = {
  summary: { total: number; pending: number; manual: number; automatic: number; shared_links: number }
  items: Item[]
  scopes: Scope[]
}
type DraftFields = { modelo: string; obra: string; local: string }

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—'
}

export default function ClassificacaoQualidadePage() {
  const [data, setData] = useState<ClassificationData | null>(null)
  const [selected, setSelected] = useState<Record<number, string[]>>({})
  const [drafts, setDrafts] = useState<Record<number, DraftFields>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/construpoint/classification')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const nextData = await response.json() as ClassificationData
      setData(nextData)
      setDrafts(Object.fromEntries(
        nextData.items.map((item) => [
          item.id,
          {
            modelo: item.modelo ?? '',
            obra: item.obra ?? '',
            local: item.local ?? '',
          },
        ])
      ))
    } catch (err) {
      logger.error({ err }, '[quality/classificacao] carregamento falhou')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  function toggleScope(inspectionId: number, scopeId: string) {
    setSelected(current => {
      const values = current[inspectionId] ?? []
      return {
        ...current,
        [inspectionId]: values.includes(scopeId)
          ? values.filter(value => value !== scopeId)
          : [...values, scopeId],
      }
    })
  }

  function updateDraft(inspectionId: number, field: keyof DraftFields, value: string) {
    setDrafts(current => ({
      ...current,
      [inspectionId]: {
        modelo: current[inspectionId]?.modelo ?? '',
        obra: current[inspectionId]?.obra ?? '',
        local: current[inspectionId]?.local ?? '',
        [field]: value,
      },
    }))
  }

  async function save(inspectionId: number) {
    const scopeIds = selected[inspectionId] ?? []
    const draft = drafts[inspectionId] ?? { modelo: '', obra: '', local: '' }
    const item = data?.items.find(entry => entry.id === inspectionId)
    if (!item) return
    const normalizedDraft = {
      modelo: draft.modelo.trim(),
      obra: draft.obra.trim(),
      local: draft.local.trim(),
    }
    const initialValues = {
      modelo: item.modelo?.trim() ?? '',
      obra: item.obra?.trim() ?? '',
      local: item.local?.trim() ?? '',
    }
    const fieldsChanged = (
      normalizedDraft.modelo !== initialValues.modelo
      || normalizedDraft.obra !== initialValues.obra
      || normalizedDraft.local !== initialValues.local
    )
    if (scopeIds.length === 0 && !fieldsChanged) return
    setSaving(inspectionId)
    setError(null)
    try {
      const response = await fetch('/api/construpoint/classification', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionId,
          scopeIds: scopeIds.length > 0 ? scopeIds : undefined,
          fields: normalizedDraft,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      setSelected(current => {
        const next = { ...current }
        delete next[inspectionId]
        return next
      })
      await load()
    } catch (err) {
      logger.error({ err }, '[quality/classificacao] salvamento falhou')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-zinc-400">Carregando classificações…</div>
  }

  if (error && !data) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-sm text-rose-400">Não foi possível carregar: {error}</p>
        <button onClick={() => void load()} className="lv-btn-ghost inline-flex items-center gap-2">
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  const cards = [
    { label: 'Inspeções únicas', value: data.summary.total, icon: Building2, color: 'text-violet-400' },
    { label: 'Classificação automática', value: data.summary.automatic, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Classificação manual', value: data.summary.manual, icon: Tags, color: 'text-sky-400' },
    { label: 'Precisam de atenção', value: data.summary.pending, icon: AlertTriangle, color: 'text-amber-400' },
  ]

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Classificação dos dados recebidos</h2>
        <p className="text-sm text-zinc-500 mt-1">
          O dado original do Construpoint é preservado. Classificações manuais prevalecem sobre as regras automáticas.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="lv-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{label}</p>
              <Icon size={15} className={color} />
            </div>
            <p className="text-2xl font-bold text-zinc-100 mt-3">{Number(value ?? 0).toLocaleString('pt-BR')}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={17} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-zinc-200">Fila de atenção</p>
            <p className="text-xs text-zinc-500 mt-1">
              Registros que não correspondem com segurança ao Corporativo, Nautic ou Hub ficam aqui até revisão humana.
              Vínculos com Nautic e Hub aparecem nos dois escopos, mas contam uma única inspeção no consolidado.
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="lv-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-[#1E1E22]">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Sem classificação</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Selecione um ou mais escopos para cada inspeção.</p>
          </div>
          <button onClick={() => void load()} className="lv-btn-ghost inline-flex items-center gap-2">
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {data.items.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 size={28} className="text-emerald-400 mx-auto" />
            <p className="text-sm text-zinc-300 mt-3">Nenhuma inspeção aguardando classificação.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E1E22]">
            {data.items.map(item => {
              const itemSelection = selected[item.id] ?? []
              return (
              <div key={item.id} className="p-4 lg:flex lg:items-center lg:justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-violet-300">{item.code ?? `#${item.id}`}</span>
                      <span className="lv-badge text-[10px]">{item.status ?? 'Sem status'}</span>
                      <span className="text-[11px] text-zinc-600">{formatDate(item.data)}</span>
                    </div>
                    <p className="text-sm font-medium text-zinc-200 mt-1.5">{item.modelo ?? 'Modelo não informado'}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Origem: {item.obra ?? '—'} · Local: {item.local ?? '—'}
                    </p>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                      {([
                        { key: 'modelo', label: 'Modelo', original: item.source_modelo, override: item.override_modelo },
                        { key: 'obra', label: 'Obra', original: item.source_obra, override: item.override_obra },
                        { key: 'local', label: 'Local', original: item.source_local, override: item.override_local },
                      ] as const).map((field) => {
                        const value = drafts[item.id]?.[field.key] ?? ''
                        const missing = value.trim().length === 0
                        return (
                          <label key={field.key} className="block">
                            <span className="block text-[11px] text-zinc-400 mb-1">
                              {field.label}
                              {missing ? <span className="text-amber-400"> · faltando</span> : null}
                              {field.override ? <span className="text-sky-400"> · ajustado manualmente</span> : null}
                            </span>
                            <input
                              value={value}
                              onChange={(event) => updateDraft(item.id, field.key, event.target.value)}
                              placeholder={field.original ?? `Informe ${field.label.toLowerCase()}`}
                              className={`w-full rounded-lg border bg-[#0F1013] px-3 py-2 text-xs text-zinc-100 outline-none transition ${
                                missing
                                  ? 'border-amber-500/40'
                                  : 'border-[#2A2A2E] focus:border-violet-400/50'
                              }`}
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4 lg:mt-0 lg:justify-end">
                    {data.scopes.map(scope => {
                      const active = itemSelection.includes(scope.id)
                      return (
                        <button
                          key={scope.id}
                          onClick={() => toggleScope(item.id, scope.id)}
                          aria-pressed={active}
                          className={`px-3 py-2 rounded-lg border text-xs transition ${
                            active
                              ? 'border-violet-400/50 bg-violet-500/15 text-violet-200'
                              : 'border-[#2A2A2E] text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {scope.nome}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => void save(item.id)}
                      disabled={saving === item.id}
                      className="lv-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving === item.id ? 'Salvando…' : 'Salvar ajustes'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
