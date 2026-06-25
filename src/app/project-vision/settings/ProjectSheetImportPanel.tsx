'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import { useUser } from '@/context/UserContext';

interface ImportReport {
  source: string;
  format: 'csv' | 'xlsx';
  totalRows: number;
  importedTasks: number;
  skippedRows: number;
  templateOnlyRows: number;
  operationalRows: number;
  projects: string[];
  perProject: Array<{
    project: string;
    importedTasks: number;
    operationalRows: number;
    templateOnlyRows: number;
    skippedRows: number;
  }>;
  sectors: string[];
  responsibles: number;
  statusAndamento: Record<string, number>;
  urgencias: Record<string, number>;
  warnings: string[];
  importedAt: string;
}

interface HealthReport {
  current: { tasks: number; projects: number; responsibles: number; healthy: boolean };
  fallback: { tasks: number; projects: number; responsibles: number; healthy: boolean };
}

export default function ProjectSheetImportPanel() {
  const { currentUser } = useUser();
  const canImport = currentUser.role === 'Desenvolvedor' || currentUser.permissions?.isAdmin === true;
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (!canImport) return null;

  async function sendImport(dryRun: boolean) {
    if (!file) return;
    setError('');
    setSuccess('');
    if (dryRun) setLoading(true);
    else setImporting(true);

    const form = new FormData();
    form.append('file', file);
    form.append('dryRun', dryRun ? 'true' : 'false');

    try {
      const res = await fetch('/api/project-vision/import-sheet', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao processar planilha.');

      setReport(data.report);
      if (!dryRun) setSuccess('Planilha importada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar planilha.');
    } finally {
      setLoading(false);
      setImporting(false);
    }
  }

  async function checkHealth() {
    setError('');
    setSuccess('');
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/project-vision/health');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao diagnosticar dados.');
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao diagnosticar dados.');
    } finally {
      setCheckingHealth(false);
    }
  }

  async function restoreFallback() {
    setError('');
    setSuccess('');
    setRestoring(true);
    try {
      const res = await fetch('/api/project-vision/health', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao restaurar dados.');
      setSuccess(`Dados restaurados: ${data.restored.tasks} tarefas`);
      await checkHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao restaurar dados.');
    } finally {
      setRestoring(false);
    }
  }

  const statusRows = report ? Object.entries(report.statusAndamento) : [];

  return (
    <section className="mt-10 border-t border-white/10 pt-8">
      <div className="flex items-center gap-2 mb-4">
        <FileSpreadsheet size={15} className="text-orange-400" />
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Importação de Planilha
        </h2>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-4">
        <div className="rounded-md border border-white/8 bg-black/20 p-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-zinc-200">Diagnóstico dos dados atuais</p>
              <p className="text-xs text-zinc-500 mt-0.5">Compara o banco com o fallback antigo empacotado no sistema.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={checkingHealth || restoring}
                onClick={checkHealth}
                className="h-8 px-3 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs font-medium text-zinc-100 flex items-center gap-2 transition-colors"
              >
                {checkingHealth && <Loader2 size={13} className="animate-spin" />}
                Verificar
              </button>
              <button
                type="button"
                disabled={checkingHealth || restoring}
                onClick={restoreFallback}
                className="h-8 px-3 rounded-md bg-amber-500/90 hover:bg-amber-400 disabled:opacity-50 text-xs font-semibold text-black flex items-center gap-2 transition-colors"
              >
                {restoring && <Loader2 size={13} className="animate-spin" />}
                Restaurar antigos
              </button>
            </div>
          </div>

          {health && (
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Banco tarefas" value={health.current.tasks} />
              <Metric label="Fallback tarefas" value={health.fallback.tasks} />
            </div>
          )}
        </div>

        <label className="flex items-center justify-between gap-3 rounded-md border border-dashed border-white/15 bg-black/20 px-3 py-3 cursor-pointer hover:border-orange-400/50 transition-colors">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-zinc-200 truncate">
              {file ? file.name : 'Selecionar arquivo'}
            </span>
            <span className="block text-xs text-zinc-500 mt-0.5">.xlsx ou .csv</span>
          </span>
          <UploadCloud size={18} className="text-zinc-400 shrink-0" />
          <input
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setReport(null);
              setError('');
              setSuccess('');
            }}
          />
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={!file || loading || importing}
            onClick={() => sendImport(true)}
            className="h-9 px-3 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:hover:bg-white/10 text-sm font-medium text-zinc-100 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            Pré-visualizar
          </button>
          <button
            type="button"
            disabled={!file || !report || loading || importing}
            onClick={() => sendImport(false)}
            className="h-9 px-3 rounded-md bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:hover:bg-orange-500 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Importar
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Metric label="Tarefas" value={report.importedTasks} />
              <Metric label="Operacionais" value={report.operationalRows} />
              <Metric label="Modelo" value={report.templateOnlyRows} />
              <Metric label="Responsáveis" value={report.responsibles} />
            </div>

            <div className="rounded-md border border-white/8 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] text-zinc-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Empreendimento</th>
                    <th className="text-right px-3 py-2 font-medium">Tarefas</th>
                    <th className="text-right px-3 py-2 font-medium">Modelo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {report.perProject.map((project) => (
                    <tr key={project.project}>
                      <td className="px-3 py-2 text-zinc-200">{project.project}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">{project.importedTasks}</td>
                      <td className="px-3 py-2 text-right text-zinc-400">{project.templateOnlyRows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              {statusRows.map(([status, count]) => (
                <span key={status} className="px-2 py-1 rounded-md bg-white/[0.06] text-[11px] text-zinc-300">
                  {status}: {count}
                </span>
              ))}
            </div>

            {report.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 space-y-1">
                {report.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/8 bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
      <p className="text-lg font-semibold text-zinc-100 mt-0.5">{value}</p>
    </div>
  );
}
