'use client'

import { ExternalLink, FileText, Info } from 'lucide-react'
import { useData } from '../../context/DataContext'
import GlassCard from '../ui/GlassCard'
import { formatDate } from '../../utils/formatters'

function statusBadge(status: string | undefined) {
  const s = (status ?? '').toUpperCase()
  const map: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE:   { bg: '#10b98120', text: '#10b981', label: 'Ativo' },
    ARCHIVED: { bg: '#6b728020', text: '#9ca3af', label: 'Arquivado' },
    DRAFT:    { bg: '#f59e0b20', text: '#f59e0b', label: 'Rascunho' },
  }
  const style = map[s] ?? { bg: '#ffffff10', text: '#9ca3af', label: status || '—' }
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}

export default function PublicarView() {
  const { leadForms } = useData()

  return (
    <div className="flex flex-col gap-6">
      {/* Notice banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-sky-500/20 bg-sky-500/5">
        <Info size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#0ea5e9' }} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Publicação via API
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            A criação e publicação de campanhas é feita através do endpoint{' '}
            <code className="px-1 py-0.5 rounded text-sky-400 bg-sky-500/10 font-mono text-xs">/api/meta/publish</code>.
            Esta tela exibe os formulários de lead cadastrados na sua conta Meta Ads.
          </p>
        </div>
      </div>

      {/* Lead forms table */}
      <GlassCard
        title="Formulários de Lead (Lead Ads)"
        action={
          <a
            href="https://www.facebook.com/ads/manager"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 hover:border-sky-500/30 hover:text-sky-400 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ExternalLink size={12} />
            Ver no Meta
          </a>
        }
      >
        {leadForms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={40} className="opacity-20" style={{ color: 'var(--text-secondary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Nenhum formulário encontrado
            </p>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-secondary)' }}>
              Crie formulários de Lead Ads no Gerenciador de Anúncios do Meta e eles aparecerão aqui automaticamente.
            </p>
            <a
              href="https://www.facebook.com/ads/manager"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors"
            >
              <ExternalLink size={12} />
              Abrir Gerenciador de Anúncios
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--text-secondary)' }}>
                  <th className="text-left py-2 px-3 font-medium">ID</th>
                  <th className="text-left py-2 px-3 font-medium">Nome</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Leads Captados</th>
                  <th className="text-left py-2 px-3 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {leadForms.map(form => (
                  <tr
                    key={form.id}
                    className="border-t border-white/5 hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <td className="py-2.5 px-3 font-mono text-xs opacity-60 max-w-[120px] truncate">
                      {form.id}
                    </td>
                    <td className="py-2.5 px-3 font-medium">{form.name}</td>
                    <td className="py-2.5 px-3">{statusBadge(form.status)}</td>
                    <td className="py-2.5 px-3">
                      {form.leads_count != null ? (
                        <span className="font-semibold" style={{ color: '#ec4899' }}>
                          {form.leads_count.toLocaleString('pt-BR')}
                        </span>
                      ) : (
                        <span className="opacity-30">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 opacity-70">
                      {formatDate(form.created_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
