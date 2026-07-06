'use client';

import { useMemo, useState, useCallback } from 'react';
import { Download, ChevronUp, ChevronDown, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ColumnAlign = 'left' | 'right' | 'center';

export interface DataTableColumn<T> {
  /** Cabeçalho da coluna */
  label: string;
  /** Campo para ordenação e exportação (pode ser string key de T) */
  field?: keyof T;
  /** Renderizador customizado da célula */
  render?: (row: T, index: number) => React.ReactNode;
  /** Valor exportado para CSV (padrão: String(row[field])) */
  csvValue?: (row: T) => string;
  align?: ColumnAlign;
  width?: string;
  /** Se false, não é sortável mesmo com field definido */
  sortable?: boolean;
}

export interface DataTableFilter<T> {
  label: string;
  field: keyof T;
  /** Opções para dropdown. Se omitido, usa busca de texto */
  options?: string[];
}

interface DataTableProps<T> {
  /** Dados completos (DataTable faz a paginação internamente) */
  rows: T[];
  columns: DataTableColumn<T>[];
  /** Filtros adicionais além da busca global */
  filters?: DataTableFilter<T>[];
  /** Campo(s) para busca de texto global (campo de busca rápida) */
  searchFields?: (keyof T)[];
  /** Linhas por página (padrão: 100) */
  pageSize?: number;
  /** Identifica cada linha unicamente */
  rowKey?: (row: T, i: number) => string | number;
  /** Placeholder da busca */
  searchPlaceholder?: string;
  /** Nome do arquivo CSV exportado */
  exportFileName?: string;
  /** Título (opcional) */
  title?: string;
  /** Estado de carregamento */
  loading?: boolean;
  /** Texto vazio */
  emptyText?: string;
  /** Ordenação inicial */
  defaultSortField?: keyof T;
  defaultSortDir?: 'asc' | 'desc';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function exportCSV<T>(rows: T[], columns: DataTableColumn<T>[], fileName: string) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const body = rows.map(row =>
    columns
      .map(c => {
        let val = '';
        if (c.csvValue) {
          val = c.csvValue(row);
        } else if (c.field !== undefined) {
          val = String(row[c.field] ?? '');
        }
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function sortRows<T>(rows: T[], field: keyof T | undefined, dir: 'asc' | 'desc'): T[] {
  if (!field) return rows;
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const an = Number(av);
    const bn = Number(bv);
    const useNum = !isNaN(an) && !isNaN(bn) && av !== '' && bv !== '';
    let cmp = 0;
    if (useNum) {
      cmp = an - bn;
    } else {
      cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

const CELL = 'py-2.5 px-3 text-[13px] whitespace-nowrap';
const HEAD = 'py-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap select-none';

export default function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  filters = [],
  searchFields = [],
  pageSize = 100,
  rowKey,
  searchPlaceholder = 'Buscar...',
  exportFileName = 'dados',
  title,
  loading = false,
  emptyText = 'Nenhum dado encontrado',
  defaultSortField,
  defaultSortDir = 'desc',
}: DataTableProps<T>) {
  const [search, setSearch]               = useState('');
  const [filterValues, setFilterValues]   = useState<Record<string, string>>({});
  const [sortField, setSortField]         = useState<keyof T | undefined>(defaultSortField);
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>(defaultSortDir);
  const [page, setPage]                   = useState(1);

  // Reset page when filters change
  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleFilter = useCallback((field: string, v: string) => {
    setFilterValues(prev => ({ ...prev, [field]: v }));
    setPage(1);
  }, []);

  const toggleSort = useCallback((field: keyof T) => {
    setSortField(prev => {
      if (prev === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; }
      setSortDir('desc');
      return field;
    });
    setPage(1);
  }, []);

  // ── Filter + search ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = rows;

    // Global text search
    if (search.trim() && searchFields.length > 0) {
      const q = search.toLowerCase();
      result = result.filter(row =>
        searchFields.some(f => String(row[f] ?? '').toLowerCase().includes(q))
      );
    }

    // Dropdown filters
    for (const [field, value] of Object.entries(filterValues)) {
      if (!value) continue;
      result = result.filter(row => String(row[field as keyof T] ?? '') === value);
    }

    return result;
  }, [rows, search, searchFields, filterValues]);

  const sorted = useMemo(() => sortRows(filtered, sortField, sortDir), [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  // Dropdown options (deduplicated)
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const f of filters) {
      if (f.options) {
        opts[String(f.field)] = f.options;
      } else {
        const vals = Array.from(new Set(rows.map(r => String(r[f.field] ?? '')).filter(Boolean))).sort();
        opts[String(f.field)] = vals;
      }
    }
    return opts;
  }, [rows, filters]);

  const hasActiveFilters = search.trim() || Object.values(filterValues).some(Boolean);

  function clearAll() {
    setSearch('');
    setFilterValues({});
    setPage(1);
  }

  // ── Chip styles ────────────────────────────────────────────────────────────
  const chip = 'shrink-0 h-9 px-3 rounded-full text-[13px] font-medium transition-all outline-none [color-scheme:dark]';
  const chipIdle = `${chip} border border-white/12 bg-white/[0.03] text-zinc-400 focus:border-white/30`;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {/* Search + export row */}
        <div className="flex items-center gap-2 flex-wrap">
          {searchFields.length > 0 && (
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className={`${chipIdle} w-full pl-8`}
              />
            </div>
          )}

          {/* Dropdown filters */}
          {filters.map(f => (
            <select
              key={String(f.field)}
              value={filterValues[String(f.field)] ?? ''}
              onChange={e => handleFilter(String(f.field), e.target.value)}
              className={`${filterValues[String(f.field)] ? chipIdle.replace('text-zinc-400', 'text-white bg-white/10') : chipIdle} max-w-[160px]`}
            >
              <option value="">{f.label}</option>
              {filterOptions[String(f.field)]?.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ))}

          {hasActiveFilters && (
            <button onClick={clearAll}
              className={`${chip} border border-white/12 bg-white/5 text-zinc-400 hover:text-white flex items-center gap-1`}>
              <X size={13} /> Limpar
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-zinc-600">
              {filtered.length.toLocaleString('pt-BR')} de {rows.length.toLocaleString('pt-BR')} {rows.length === 1 ? 'registro' : 'registros'}
            </span>
            <button
              onClick={() => exportCSV(sorted, columns, exportFileName)}
              className={`${chip} border border-white/12 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/10 flex items-center gap-1.5 text-[12px]`}
              title="Exportar CSV"
            >
              <Download size={13} /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.02]">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">
            <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Carregando...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {columns.map((col, i) => {
                  const sortable = col.sortable !== false && col.field !== undefined;
                  const isActive = sortField === col.field;
                  return (
                    <th
                      key={i}
                      className={`${HEAD} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${sortable ? 'cursor-pointer hover:text-zinc-300 transition-colors' : ''}`}
                      style={{ width: col.width }}
                      onClick={() => sortable && col.field && toggleSort(col.field)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortable && (
                          <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                            {isActive && sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-sky-400">
                            {sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-zinc-600 text-sm">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr
                    key={rowKey ? rowKey(row, i) : i}
                    className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    {columns.map((col, ci) => (
                      <td
                        key={ci}
                        className={`${CELL} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} text-zinc-300`}
                      >
                        {col.render
                          ? col.render(row, (page - 1) * pageSize + i)
                          : col.field !== undefined
                            ? String(row[col.field] ?? '—')
                            : '—'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-zinc-500">
          <span>Página {page} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30 transition-colors"
            >«</button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30 transition-colors flex items-center gap-0.5"
            >
              <ChevronLeft size={13} /> Ant.
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let p: number;
              if (totalPages <= 5) p = idx + 1;
              else if (page <= 3) p = idx + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + idx;
              else p = page - 2 + idx;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded text-[12px] transition-colors ${p === page ? 'bg-sky-500/20 text-sky-400 font-semibold' : 'hover:bg-white/5'}`}
                >{p}</button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30 transition-colors flex items-center gap-0.5"
            >
              Próx. <ChevronRight size={13} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30 transition-colors"
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}
