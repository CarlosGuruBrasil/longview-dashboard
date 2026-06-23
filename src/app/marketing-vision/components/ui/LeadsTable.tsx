'use client';

import { useMemo, useState } from 'react';
import type { Lead } from '../../types';
import {
  getOrigin,
  getStatusColor,
  getLeadTags,
  isLeadBolsao,
  toISODate,
} from '../../utils/leads';
import { formatDate } from '../../utils/formatters';

interface LeadsTableProps {
  leads: Lead[];
}

const MAX_ROWS = 200;

function unique(values: (string | undefined | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();
}

export default function LeadsTable({ leads }: LeadsTableProps) {
  const [filterNome, setFilterNome] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [filterCorretor, setFilterCorretor] = useState('');
  const [filterGestor, setFilterGestor] = useState('');
  const [filterImobiliaria, setFilterImobiliaria] = useState('');
  const [filterEmpreendimento, setFilterEmpreendimento] = useState('');
  const [filterEtapa, setFilterEtapa] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterBolsao, setFilterBolsao] = useState('');

  // Build dropdown options from leads data
  const options = useMemo(() => {
    return {
      origens: unique(leads.map((l) => getOrigin(l))),
      corretores: unique(leads.map((l) => l.corretor?.nome)),
      gestores: unique(leads.map((l) => l.gestor?.nome)),
      imobiliarias: unique(leads.map((l) => l.imobiliaria?.nome)),
      empreendimentos: unique(leads.flatMap((l) => l.empreendimento?.map((e) => e.nome) ?? [])),
      etapas: unique(leads.map((l) => l.situacao?.nome)),
      tags: unique(leads.flatMap((l) => getLeadTags(l))),
    };
  }, [leads]);

  const filtered = useMemo(() => {
    const nomeLower = filterNome.toLowerCase();
    const dateFilter = filterDate.replace(/\D/g, '');

    return leads.filter((lead) => {
      if (nomeLower && !(lead.nome ?? '').toLowerCase().includes(nomeLower)) return false;

      if (dateFilter) {
        const iso = toISODate(lead.data_cad || lead.data_cadastro || lead.data_cadastramento);
        if (!iso) return false;
        const [yy, mm, dd] = iso.split('-');
        if (!dd || !mm || !yy) return false;
        const dateParts = `${dd}/${mm}/${yy}`;
        if (!dateParts.includes(dateFilter)) return false;
      }

      if (filterOrigem && getOrigin(lead) !== filterOrigem) return false;
      if (filterCorretor && lead.corretor?.nome !== filterCorretor) return false;
      if (filterGestor && lead.gestor?.nome !== filterGestor) return false;
      if (filterImobiliaria && lead.imobiliaria?.nome !== filterImobiliaria) return false;
      if (filterEmpreendimento && !(lead.empreendimento ?? []).some((e) => e.nome === filterEmpreendimento)) return false;
      if (filterEtapa && lead.situacao?.nome !== filterEtapa) return false;
      if (filterTag && !getLeadTags(lead).includes(filterTag)) return false;
      if (filterBolsao) {
        const isBolsao = isLeadBolsao(lead);
        if (filterBolsao === 'sim' && !isBolsao) return false;
        if (filterBolsao === 'nao' && isBolsao) return false;
      }

      return true;
    });
  }, [leads, filterNome, filterDate, filterOrigem, filterCorretor, filterGestor, filterImobiliaria, filterEmpreendimento, filterEtapa, filterTag, filterBolsao]);

  const displayed = filtered.slice(0, MAX_ROWS);

  function clearFilters() {
    setFilterNome('');
    setFilterDate('');
    setFilterOrigem('');
    setFilterCorretor('');
    setFilterGestor('');
    setFilterImobiliaria('');
    setFilterEmpreendimento('');
    setFilterEtapa('');
    setFilterTag('');
    setFilterBolsao('');
  }

  const hasActiveFilters =
    filterNome || filterDate || filterOrigem || filterCorretor || filterGestor ||
    filterImobiliaria || filterEmpreendimento || filterEtapa || filterTag || filterBolsao;

  // ── Adidas-style chip classes ────────────────────────────────────────────
  // max-w-[140px] impede selects de expandirem com opções longas (ex: "Aguardando Atendimento Corretor")
  const chip = 'no-tap shrink-0 h-9 px-3 rounded-full text-[13px] font-medium transition-all [color-scheme:dark] max-w-[140px]';
  const chipIdle    = `${chip} border border-white/12 bg-white/[0.03] text-zinc-400 focus:outline-none focus:border-white/30`;
  const chipActive  = `${chip} bg-white/90 text-zinc-900 border-transparent`;

  return (
    <div className="flex flex-col gap-3">
      {/* Linha 1: busca textual */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={filterNome}
          onChange={(e) => setFilterNome(e.target.value)}
          className={`${chipIdle} flex-1 min-w-0 placeholder:text-zinc-600`}
        />
        <input
          type="text"
          placeholder="dd/mm..."
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className={`${chipIdle} w-24`}
        />
        {hasActiveFilters && (
          <button onClick={clearFilters} className={`${chipActive} !bg-zinc-700/60 !text-zinc-300 !border-white/10`}>
            ✕
          </button>
        )}
      </div>

      {/* Linha 2: selects horizontais scrolláveis — estilo Adidas */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        {[
          { value: filterEtapa,          setter: setFilterEtapa,          opts: options.etapas,          label: 'Etapa' },
          { value: filterOrigem,         setter: setFilterOrigem,         opts: options.origens,         label: 'Origem' },
          { value: filterCorretor,       setter: setFilterCorretor,       opts: options.corretores,      label: 'Corretor' },
          { value: filterEmpreendimento, setter: setFilterEmpreendimento, opts: options.empreendimentos, label: 'Empreendimento' },
          { value: filterGestor,         setter: setFilterGestor,         opts: options.gestores,        label: 'Gestor' },
          { value: filterImobiliaria,    setter: setFilterImobiliaria,    opts: options.imobiliarias,    label: 'Imobiliária' },
          { value: filterTag,            setter: setFilterTag,            opts: options.tags,            label: 'Tag' },
        ].map(({ value, setter, opts, label }) => (
          <select
            key={label}
            value={value}
            onChange={(e) => setter(e.target.value)}
            className={value ? chipActive : chipIdle}
          >
            <option value="">{label}</option>
            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <select
          value={filterBolsao}
          onChange={(e) => setFilterBolsao(e.target.value)}
          className={filterBolsao ? chipActive : chipIdle}
        >
          <option value="">Bolsão</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      </div>

      {/* Count */}
      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        {filtered.length} leads
        {filtered.length > MAX_ROWS && ` (mostrando ${MAX_ROWS})`}
      </p>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-2">
        {displayed.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum lead encontrado.</p>
        ) : displayed.map((lead, idx) => {
          const id = lead.idlead ?? lead.id;
          const crmUrl = id ? `https://longviewempreendimentos.cvcrm.com.br/gestor/comercial/leads/${id}/detalhes` : undefined;
          const sc = getStatusColor(lead);
          const rawDate = lead.data_cad || lead.data_cadastro || lead.data_cadastramento;
          return (
            <div
              key={id ?? idx}
              onClick={() => crmUrl && window.open(crmUrl, '_blank', 'noopener,noreferrer')}
              className={`rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-1.5 ${crmUrl ? 'cursor-pointer active:bg-white/10' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{lead.nome || '-'}</span>
                {lead.situacao?.nome && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: sc.bg, color: sc.text }}>
                    {lead.situacao.nome}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>{formatDate(toISODate(rawDate))}</span>
                <span>{getOrigin(lead)}</span>
                {lead.corretor?.nome && <span>{lead.corretor.nome}</span>}
                {lead.empreendimento?.[0]?.nome && <span>{lead.empreendimento[0].nome}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {['Nome', 'Cadastro', 'Origem', 'Etapa', 'Corretor', 'Gestor', 'Imobiliária', 'Empreendimento', 'Tags'].map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2.5 font-semibold whitespace-nowrap"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((lead, idx) => {
              const id = lead.idlead ?? lead.id;
              const crmUrl = id
                ? `https://longviewempreendimentos.cvcrm.com.br/gestor/comercial/leads/${id}/detalhes`
                : undefined;
              const tags = getLeadTags(lead);
              const sc = getStatusColor(lead);
              const rawDate = lead.data_cad || lead.data_cadastro || lead.data_cadastramento;
              const formattedDate = formatDate(toISODate(rawDate));
              const empreendimento = lead.empreendimento?.[0]?.nome ?? '-';

              const RowContent = (
                <>
                  <td
                    className="px-3 py-2 whitespace-nowrap font-medium max-w-[160px] truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {lead.nome || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {formattedDate}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {getOrigin(lead)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {lead.situacao?.nome ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {lead.situacao.nome}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {lead.corretor?.nome || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {lead.gestor?.nome || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {lead.imobiliaria?.nome || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {empreendimento}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-white/10"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          +{tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </>
              );

              return crmUrl ? (
                <tr
                  key={id ?? idx}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => window.open(crmUrl, '_blank', 'noopener,noreferrer')}
                >
                  {RowContent}
                </tr>
              ) : (
                <tr
                  key={idx}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  {RowContent}
                </tr>
              );
            })}
            {displayed.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-8 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Nenhum lead encontrado com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>{/* end desktop table */}
    </div>
  );
}
