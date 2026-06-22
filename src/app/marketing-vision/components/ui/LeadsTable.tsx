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

  const selectCls =
    'bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-white/30 min-w-[110px]';
  const inputCls =
    'bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-white/30';

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-end">
        <input
          type="text"
          placeholder="Nome..."
          value={filterNome}
          onChange={(e) => setFilterNome(e.target.value)}
          className={`${inputCls} min-w-[140px]`}
          style={{ color: 'var(--text-primary)' }}
        />
        <input
          type="text"
          placeholder="Data (dd/mm)..."
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className={`${inputCls} min-w-[130px]`}
          style={{ color: 'var(--text-primary)' }}
        />

        <select
          value={filterOrigem}
          onChange={(e) => setFilterOrigem(e.target.value)}
          className={selectCls}
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Origem</option>
          {options.origens.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <select
          value={filterEtapa}
          onChange={(e) => setFilterEtapa(e.target.value)}
          className={selectCls}
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Etapa</option>
          {options.etapas.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <select
          value={filterCorretor}
          onChange={(e) => setFilterCorretor(e.target.value)}
          className={selectCls}
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Corretor</option>
          {options.corretores.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <select
          value={filterGestor}
          onChange={(e) => setFilterGestor(e.target.value)}
          className={selectCls}
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Gestor</option>
          {options.gestores.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <select
          value={filterImobiliaria}
          onChange={(e) => setFilterImobiliaria(e.target.value)}
          className={selectCls}
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Imobiliária</option>
          {options.imobiliarias.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <select
          value={filterEmpreendimento}
          onChange={(e) => setFilterEmpreendimento(e.target.value)}
          className={selectCls}
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Empreendimento</option>
          {options.empreendimentos.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className={selectCls}
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Tag</option>
          {options.tags.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <select
          value={filterBolsao}
          onChange={(e) => setFilterBolsao(e.target.value)}
          className={selectCls}
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Bolsão</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
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
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: sc.bg, color: sc.text }}>
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
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
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
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-white/10"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
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
