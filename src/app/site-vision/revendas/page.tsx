'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader2, Plus, Trash2, Upload, ExternalLink, Building2, Pencil, X,
  GripVertical, Star, ChevronDown, ChevronRight, ZoomIn, ArrowLeft, ArrowRight,
} from 'lucide-react';

type EmpItem = {
  id: number; nome: string; slug: string; cidade: string; estado: string; origem: 'cvcrm' | 'manual'; ordem: number;
  unidades_disponiveis?: number; revendas_disponiveis?: number;
};
type RevendaItem = { id: number; slug: string; titulo: string; tipologia?: string | null; preco: number | null; status: string };
type Midia = { id: number; tipo: 'foto' | 'planta' | 'documento'; url_storage: string; url_thumb?: string | null; ordem: number; destaque?: boolean; descricao?: string | null };
type TeamMember = { id: string; name: string; email: string; phone: string; whatsapp: string; avatarUrl: string };

const SITE_BASE_URL = 'https://longview.guru.dev.br';

const inputClass = 'h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100 outline-none';
const labelClass = 'block space-y-1.5';
const labelTextClass = 'text-xs font-semibold uppercase tracking-wide text-zinc-500';
const cardClass = 'rounded-[24px] border border-white/8 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]';
const btnPrimary = 'inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait';
const btnGhost = 'inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09] text-xs font-medium transition-colors';

const emptyRevForm = {
  empreendimentoId: '', titulo: '', tipologia: '', descricao: '', preco: '', areaPrivativa: '', areaTotal: '',
  dormitorios: '', suites: '', vagas: '', andar: '', bloco: '', posicao: '',
  corretorNome: '', corretorTelefone: '', corretorEmail: '', corretorFoto: '',
};

const TIPOLOGIAS = ['Apartamento', 'Cobertura', 'Cobertura Duplex', 'Studio', 'Casa'];

// Number(str) so entende ponto como decimal — "R$ 500.000" (formato BR, ponto
// como milhar) virava NaN e, pior, JSON.stringify(NaN) vira "null" sem erro
// nenhum, entao o preco simplesmente sumia sem avisar ninguem. Aceita "R$",
// espaco, ponto de milhar e virgula decimal.
function parseBRLNumber(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const lastSep = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  if (lastSep === -1) {
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const intPart = cleaned.slice(0, lastSep).replace(/[.,]/g, '');
  const decPart = cleaned.slice(lastSep + 1).replace(/[.,]/g, '');
  const n = Number(`${intPart}.${decPart}`);
  return Number.isFinite(n) ? n : null;
}

// Mascara de moeda "digite e ja aparece formatado" — le so os digitos (como
// centavos) e formata em R$ a cada tecla, no padrao dos campos de valor de
// banco/maquininha. Evita de vez o problema de formato ambiguo do
// parseBRLNumber acima, ja que o usuario nunca digita separador na mao.
function formatPrecoDigitado(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function RevendasPage() {
  const searchParams = useSearchParams();
  const empFilterApplied = useRef(false);
  const editPanelRef = useRef<HTMLDivElement | null>(null);

  const [empreendimentos, setEmpreendimentos] = useState<EmpItem[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [dragEmpId, setDragEmpId] = useState<number | null>(null);

  // Revendas de cada empreendimento sao carregadas sob demanda, quando a linha
  // e expandida — evita N chamadas de uma vez pra lista inteira.
  const [expandedEmpId, setExpandedEmpId] = useState<number | null>(null);
  const [revendasPorEmp, setRevendasPorEmp] = useState<Record<number, RevendaItem[]>>({});
  const [loadingRevendasEmpId, setLoadingRevendasEmpId] = useState<number | null>(null);

  const [editingRevendaId, setEditingRevendaId] = useState<number | null>(null);
  const [revForm, setRevForm] = useState(emptyRevForm);
  const [revSaving, setRevSaving] = useState(false);
  const [revMsg, setRevMsg] = useState('');
  const [activeRevenda, setActiveRevenda] = useState<{ id: number; slug: string; empSlug: string; empNome: string } | null>(null);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [dragMidiaId, setDragMidiaId] = useState<number | null>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const [team, setTeam] = useState<TeamMember[]>([]);

  const loadEmpreendimentos = async () => {
    setLoadingEmps(true);
    try {
      const res = await fetch('/api/site-vision/site-empreendimentos');
      const json = await res.json();
      setEmpreendimentos(json.empreendimentos ?? []);
    } finally {
      setLoadingEmps(false);
    }
  };

  const loadTeam = async () => {
    try {
      const res = await fetch('/api/site-vision/team');
      const json = await res.json();
      setTeam(json.team ?? []);
    } catch {
      setTeam([]);
    }
  };

  useEffect(() => { loadEmpreendimentos(); loadTeam(); }, []);

  const selecionarCorretor = (memberId: string) => {
    const m = team.find((t) => t.id === memberId);
    if (!m) {
      setRevForm((f) => ({ ...f, corretorNome: '', corretorTelefone: '', corretorEmail: '', corretorFoto: '' }));
      return;
    }
    setRevForm((f) => ({
      ...f,
      corretorNome: m.name,
      corretorTelefone: m.whatsapp || m.phone || '',
      corretorEmail: m.email,
      corretorFoto: m.avatarUrl || '',
    }));
  };

  const onDropEmp = async (targetId: number) => {
    if (dragEmpId === null || dragEmpId === targetId) return;
    const list = [...empreendimentos];
    const fromIdx = list.findIndex((e) => e.id === dragEmpId);
    const toIdx = list.findIndex((e) => e.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setEmpreendimentos(list);
    setDragEmpId(null);
    setReordering(true);
    try {
      await Promise.all(
        list.map((e, idx) =>
          e.ordem === idx
            ? Promise.resolve()
            : fetch(`/api/site-vision/site-empreendimentos/${e.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordem: idx }),
              })
        )
      );
      await loadEmpreendimentos();
    } finally {
      setReordering(false);
    }
  };

  const carregarRevendasDoEmpreendimento = async (empId: number) => {
    setLoadingRevendasEmpId(empId);
    try {
      const res = await fetch(`/api/site-vision/site-empreendimentos/${empId}`);
      const json = await res.json();
      setRevendasPorEmp((prev) => ({ ...prev, [empId]: json.empreendimento?.revendas ?? [] }));
    } finally {
      setLoadingRevendasEmpId(null);
    }
  };

  const toggleExpandEmp = (empId: number) => {
    const next = expandedEmpId === empId ? null : empId;
    setExpandedEmpId(next);
    if (next !== null && !revendasPorEmp[next]) carregarRevendasDoEmpreendimento(next);
  };

  const abrirNovaRevenda = (empId: number) => {
    setEditingRevendaId(null);
    setActiveRevenda(null);
    setMidias([]);
    setRevMsg('');
    const emp = empreendimentos.find((e) => e.id === empId);
    setRevForm({ ...emptyRevForm, empreendimentoId: String(empId) });
    setShowEditPanel(true);
    setTimeout(() => editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    void emp;
  };

  const carregarRevendaParaEdicao = async (r: RevendaItem, empId: number) => {
    setRevMsg('');
    try {
      const res = await fetch(`/api/site-vision/site-revendas/${r.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar revenda.');
      const rev = json.revenda;
      setEditingRevendaId(rev.id);
      setRevForm({
        empreendimentoId: String(empId),
        titulo: rev.titulo || '',
        tipologia: rev.tipologia || '',
        descricao: rev.descricao || '',
        preco: rev.preco != null ? Number(rev.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
        areaPrivativa: rev.area_privativa ?? '',
        areaTotal: rev.area_total ?? '',
        dormitorios: rev.dormitorios ?? '',
        suites: rev.suites ?? '',
        vagas: rev.vagas ?? '',
        andar: rev.andar ?? '',
        bloco: rev.bloco || '',
        posicao: rev.posicao || '',
        corretorNome: rev.corretor_nome || '',
        corretorTelefone: rev.corretor_telefone || '',
        corretorEmail: rev.corretor_email || '',
        corretorFoto: rev.corretor_foto || '',
      });
      const emp = empreendimentos.find((e) => e.id === empId);
      setActiveRevenda({ id: rev.id, slug: rev.slug, empSlug: emp?.slug ?? rev.empreendimento?.slug ?? '', empNome: emp?.nome ?? rev.empreendimento?.nome ?? '' });
      setMidias(rev.midias ?? []);
      setShowEditPanel(true);
      setTimeout(() => editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (error) {
      setRevMsg(error instanceof Error ? error.message : 'Erro ao carregar revenda.');
    }
  };

  const cancelarEdicao = () => {
    setEditingRevendaId(null);
    setRevForm(emptyRevForm);
    setActiveRevenda(null);
    setMidias([]);
    setRevMsg('');
    setShowEditPanel(false);
  };

  const salvarRevenda = async () => {
    setRevSaving(true);
    setRevMsg('');
    try {
      const payloadBase = {
        titulo: revForm.titulo,
        tipologia: revForm.tipologia || undefined,
        descricao: revForm.descricao || undefined,
        preco: revForm.preco ? parseBRLNumber(revForm.preco) : null,
        areaPrivativa: revForm.areaPrivativa ? Number(revForm.areaPrivativa) : null,
        areaTotal: revForm.areaTotal ? Number(revForm.areaTotal) : null,
        dormitorios: revForm.dormitorios ? Number(revForm.dormitorios) : null,
        suites: revForm.suites ? Number(revForm.suites) : null,
        vagas: revForm.vagas ? Number(revForm.vagas) : null,
        andar: revForm.andar ? Number(revForm.andar) : null,
        bloco: revForm.bloco || undefined,
        posicao: revForm.posicao || undefined,
        corretorNome: revForm.corretorNome || undefined,
        corretorTelefone: revForm.corretorTelefone || undefined,
        corretorEmail: revForm.corretorEmail || undefined,
        corretorFoto: revForm.corretorFoto || undefined,
      };
      const empId = Number(revForm.empreendimentoId);

      if (editingRevendaId) {
        const res = await fetch(`/api/site-vision/site-revendas/${editingRevendaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBase),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao salvar revenda.');
        setRevMsg('Alterações salvas.');
        await carregarRevendasDoEmpreendimento(empId);
      } else {
        const payload = { ...payloadBase, empreendimentoId: empId };
        const res = await fetch('/api/site-vision/site-revendas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao criar revenda.');
        const emp = empreendimentos.find((e) => e.id === empId);
        setActiveRevenda({ id: json.revenda.id, slug: json.revenda.slug, empSlug: emp?.slug ?? '', empNome: emp?.nome ?? '' });
        setEditingRevendaId(json.revenda.id);
        setMidias([]);
        setRevMsg(`Revenda "${json.revenda.titulo}" criada. Agora envie as fotos abaixo.`);
        await carregarRevendasDoEmpreendimento(empId);
      }
    } catch (error) {
      setRevMsg(error instanceof Error ? error.message : 'Erro ao salvar revenda.');
    } finally {
      setRevSaving(false);
    }
  };

  const uploadMidias = async (files: FileList | null, tipo: 'foto' | 'planta' | 'documento') => {
    if (!files || !files.length || !activeRevenda) return;
    setUploadBusy(true);
    let ok = 0;
    const ordemBase = midias.filter((m) => m.tipo === tipo).length;
    const novas: Midia[] = [];
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`Enviando ${i + 1}/${files.length}...`);
      try {
        const dataUrl = await fileToDataUrl(files[i]);
        const res = await fetch(`/api/site-vision/site-revendas/${activeRevenda.id}/midias`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo, dataUrl, ordem: ordemBase + i }),
        });
        const json = await res.json();
        if (res.ok) {
          ok += 1;
          novas.push({ id: json.midia.id, tipo, url_storage: json.midia.url_storage, url_thumb: json.midia.url_thumb, ordem: ordemBase + i });
        }
      } catch {
        // segue pro proximo arquivo mesmo se um falhar
      }
    }
    setMidias((prev) => [...prev, ...novas]);
    setUploadProgress(`${ok}/${files.length} enviados com sucesso.`);
    setUploadBusy(false);
  };

  const removerMidia = async (midiaId: number) => {
    if (!confirm('Remover esse arquivo?')) return;
    await fetch(`/api/site-vision/site-revendas/midias/${midiaId}`, { method: 'DELETE' });
    setMidias((prev) => prev.filter((m) => m.id !== midiaId));
  };

  const toggleDestaque = async (midiaId: number, atual: boolean) => {
    const novoValor = !atual;
    setMidias((prev) => prev.map((m) => (m.id === midiaId ? { ...m, destaque: novoValor } : m)));
    await fetch(`/api/site-vision/site-revendas/midias/${midiaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destaque: novoValor }),
    });
  };

  const salvarDescricaoMidia = async (midiaId: number, descricao: string) => {
    setMidias((prev) => prev.map((m) => (m.id === midiaId ? { ...m, descricao } : m)));
    await fetch(`/api/site-vision/site-revendas/midias/${midiaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao }),
    });
  };

  const onDropMidia = async (targetId: number, tipo: Midia['tipo']) => {
    if (dragMidiaId === null || dragMidiaId === targetId || !activeRevenda) return;
    const grupo = midias.filter((m) => m.tipo === tipo);
    const resto = midias.filter((m) => m.tipo !== tipo);
    const fromIdx = grupo.findIndex((m) => m.id === dragMidiaId);
    const toIdx = grupo.findIndex((m) => m.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = grupo.splice(fromIdx, 1);
    grupo.splice(toIdx, 0, moved);
    const reindexed = grupo.map((m, idx) => ({ ...m, ordem: idx }));
    setMidias([...resto, ...reindexed]);
    setDragMidiaId(null);

    await fetch(`/api/site-vision/site-revendas/${activeRevenda.id}/midias/ordem`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordem: reindexed.map((m) => ({ id: m.id, ordem: m.ordem })) }),
    });
  };

  // Vindo do link "Ver revendas disponíveis" na tela de Empreendimentos
  // (/site-vision/revendas?emp=ID) — expande direto a linha certa.
  useEffect(() => {
    const empParam = searchParams.get('emp');
    if (empParam && empreendimentos.length > 0 && !empFilterApplied.current) {
      empFilterApplied.current = true;
      const id = Number(empParam);
      setExpandedEmpId(id);
      carregarRevendasDoEmpreendimento(id);
    }
  }, [searchParams, empreendimentos]);

  const removerRevenda = async (id: number, empId: number) => {
    if (!confirm('Remover essa revenda do site? As fotos vão junto.')) return;
    await fetch(`/api/site-vision/site-revendas/${id}`, { method: 'DELETE' });
    if (editingRevendaId === id) cancelarEdicao();
    await carregarRevendasDoEmpreendimento(empId);
  };

  const fotos = midias.filter((m) => m.tipo === 'foto').sort((a, b) => a.ordem - b.ordem);
  const outrasMidias = midias.filter((m) => m.tipo !== 'foto');

  // Editando/cadastrando revenda toma a tela inteira, sem a lista de
  // empreendimentos por baixo empilhada — evita a bagunca visual de mostrar as
  // duas coisas ao mesmo tempo. "Voltar" fecha o painel e volta pra lista.
  if (showEditPanel) {
    return (
      <div className="space-y-6 p-6">
        <button className={btnGhost} onClick={cancelarEdicao}>
          <ArrowLeft size={14} /> Voltar
        </button>

        <div className={cardClass} ref={editPanelRef}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {editingRevendaId ? <Pencil size={16} className="text-teal-300" /> : <Plus size={16} className="text-teal-300" />}
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {empreendimentos.find((e) => String(e.id) === revForm.empreendimentoId)?.nome ?? activeRevenda?.empNome ?? 'Empreendimento'}
                  {' → '}
                  {editingRevendaId ? (revForm.titulo || 'Editando revenda') : 'Nova revenda'}
                </h2>
                <p className="text-xs text-zinc-500">
                  {editingRevendaId ? 'Editando revenda existente' : 'Cadastrando nova revenda'}
                </p>
              </div>
            </div>
            <button className={btnPrimary} disabled={revSaving || !revForm.empreendimentoId || !revForm.titulo || (!editingRevendaId && !revForm.tipologia)} onClick={salvarRevenda}>
              {revSaving ? <Loader2 size={14} className="animate-spin" /> : editingRevendaId ? <Pencil size={14} /> : <Plus size={14} />}
              {editingRevendaId ? 'Salvar alterações' : 'Criar revenda'}
            </button>
          </div>
          {revMsg ? <p className="mb-4 text-xs text-teal-300">{revMsg}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              <span className={labelTextClass}>Tipologia (define a URL da página)</span>
              <select
                className={inputClass}
                value={revForm.tipologia}
                onChange={(e) => setRevForm((f) => ({ ...f, tipologia: e.target.value }))}
              >
                <option value="">Selecione</option>
                {TIPOLOGIAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Título (marketing, não aparece na URL)</span>
              <input className={inputClass} value={revForm.titulo} onChange={(e) => setRevForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Cobertura Duplex Reformada — vista mar" />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              <span className={labelTextClass}>Descrição</span>
              <textarea
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
                rows={12}
                value={revForm.descricao}
                onChange={(e) => setRevForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </label>
            <label className={labelClass}>
              <span className={labelTextClass}>Preço (R$, uso interno — não aparece no site)</span>
              <input
                className={inputClass}
                inputMode="numeric"
                value={revForm.preco}
                placeholder="R$ 0,00"
                onChange={(e) => setRevForm((f) => ({ ...f, preco: formatPrecoDigitado(e.target.value) }))}
              />
            </label>
            {[
              ['areaPrivativa', 'Área privativa (m²)'],
              ['areaTotal', 'Área total (m²)'],
              ['dormitorios', 'Dormitórios'],
              ['suites', 'Suítes'],
              ['vagas', 'Vagas'],
              ['andar', 'Andar'],
              ['bloco', 'Bloco'],
              ['posicao', 'Posição (ex: Frente mar)'],
            ].map(([key, label]) => (
              <label className={labelClass} key={key}>
                <span className={labelTextClass}>{label}</span>
                <input className={inputClass} value={(revForm as Record<string, string>)[key]} onChange={(e) => setRevForm((f) => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
            <label className={`${labelClass} sm:col-span-2`}>
              <span className={labelTextClass}>Corretor (do People Vision — time Comercial/Corretor)</span>
              <select
                className={inputClass}
                value={team.find((t) => t.email === revForm.corretorEmail)?.id ?? ''}
                onChange={(e) => selecionarCorretor(e.target.value)}
              >
                <option value="">Sem corretor definido</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {revForm.corretorNome ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                  {revForm.corretorFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={revForm.corretorFoto} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : null}
                  {revForm.corretorNome} {revForm.corretorTelefone ? `· ${revForm.corretorTelefone}` : ''}
                </div>
              ) : null}
            </label>
          </div>

          {activeRevenda ? (
            <div className="mt-5 rounded-xl border border-teal-400/20 bg-teal-500/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Revenda ativa</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a
                  href={`${SITE_BASE_URL}/${activeRevenda.empSlug}/revenda/${activeRevenda.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-teal-300 hover:text-teal-200"
                >
                  Ver página no site <ExternalLink size={13} />
                </a>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={btnGhost} style={{ cursor: 'pointer' }}>
                  <Upload size={14} /> Enviar planta / documento
                  <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => uploadMidias(e.target.files, 'documento')} disabled={uploadBusy} />
                </label>
                <label className={btnGhost} style={{ cursor: 'pointer' }}>
                  <Upload size={14} /> Enviar fotos (várias)
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => uploadMidias(e.target.files, 'foto')} disabled={uploadBusy} />
                </label>
              </div>
              {uploadProgress ? <p className="mt-2 text-xs text-zinc-400">{uploadProgress}</p> : null}

              {/* Documentos/plantas primeiro — sao poucos e importam mais que a galeria */}
              {outrasMidias.length > 0 ? (
                <div className="mt-4 space-y-1">
                  <p className="mb-1 text-xs text-zinc-500">Plantas e documentos — dê um nome pra cada um.</p>
                  {outrasMidias.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <a href={`${SITE_BASE_URL}${m.url_storage}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-teal-300 hover:text-teal-200">
                        Abrir
                      </a>
                      <input
                        className="h-8 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-xs text-zinc-100 outline-none"
                        placeholder={m.tipo === 'planta' ? 'Nome da planta (ex: Planta baixa)' : 'Nome do documento (ex: Matrícula, IPTU)'}
                        defaultValue={m.descricao ?? ''}
                        onBlur={(e) => { if (e.target.value !== (m.descricao ?? '')) salvarDescricaoMidia(m.id, e.target.value); }}
                      />
                      <button onClick={() => removerMidia(m.id)} className="shrink-0 text-red-300 hover:text-red-200">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {fotos.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-1 text-xs text-zinc-500">
                    {fotos.length} foto(s) — arraste pra reordenar (a 1ª vira a capa), clique na lupa pra ampliar.
                  </p>
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2">
                    <Star size={12} className="shrink-0 text-yellow-400" fill="currentColor" />
                    <p className="text-xs text-amber-100/80">
                      <strong className="text-amber-200">{fotos.filter((f) => f.destaque).length} de {fotos.length} marcada(s) como destaque.</strong>{' '}
                      {fotos.filter((f) => f.destaque).length >= 2
                        ? 'A página do imóvel vai intercalar texto com essas fotos, na ordem em que foram marcadas (número no canto).'
                        : 'Marque pelo menos 2 pra curar quais fotos entram na seção de texto+foto — com 0 ou 1 marcada, o site usa a galeria inteira automaticamente.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
                    {(() => {
                      let destaqueSeq = 0;
                      return fotos.map((m, idx) => {
                        const destaqueOrdem = m.destaque ? ++destaqueSeq : null;
                        return (
                          <div
                            key={m.id}
                            draggable
                            onDragStart={() => setDragMidiaId(m.id)}
                            onDragOver={(ev) => ev.preventDefault()}
                            onDrop={() => onDropMidia(m.id, 'foto')}
                            className={`group relative aspect-square cursor-grab overflow-hidden rounded-lg border active:cursor-grabbing ${m.destaque ? 'border-yellow-400/60' : 'border-white/10'}`}
                          >
                            <img
                              src={`${SITE_BASE_URL}${m.url_thumb || m.url_storage}`}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            <button
                              onClick={() => setLightboxIdx(idx)}
                              title="Ampliar"
                              className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex"
                            >
                              <ZoomIn size={16} className="text-white" />
                            </button>
                            <button
                              onClick={() => toggleDestaque(m.id, !!m.destaque)}
                              title={m.destaque ? `Destaque nº ${destaqueOrdem} — clique pra remover` : 'Marcar como destaque'}
                              className={`absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-black/70 px-1 py-1 ${m.destaque ? 'text-yellow-400' : 'hidden text-zinc-300 group-hover:flex'}`}
                            >
                              <Star size={11} fill={m.destaque ? 'currentColor' : 'none'} />
                              {destaqueOrdem ? <span className="text-[9px] font-bold leading-none">{destaqueOrdem}</span> : null}
                            </button>
                            <button
                              onClick={() => removerMidia(m.id)}
                              className="absolute right-1 top-1 hidden rounded-full bg-black/70 p-1 text-red-300 group-hover:block"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {lightboxIdx !== null && fotos[lightboxIdx] ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
            onClick={() => setLightboxIdx(null)}
          >
            <button className="absolute right-6 top-6 text-white" onClick={() => setLightboxIdx(null)}>
              <X size={28} />
            </button>
            {fotos.length > 1 ? (
              <button
                className="absolute left-6 text-white"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i === null ? null : (i - 1 + fotos.length) % fotos.length)); }}
              >
                <ArrowLeft size={28} />
              </button>
            ) : null}
            <img
              src={`${SITE_BASE_URL}${fotos[lightboxIdx].url_storage}`}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {fotos.length > 1 ? (
              <button
                className="absolute right-6 text-white"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i === null ? null : (i + 1) % fotos.length)); }}
              >
                <ArrowRight size={28} />
              </button>
            ) : null}
            <p className="absolute bottom-6 text-xs text-zinc-400">{lightboxIdx + 1} / {fotos.length}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-white">Revendas</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Unidades já vendidas, à venda por fora do incorporador — cada revenda ganha uma página própria no site.
        </p>
      </div>

      {/* Empreendimentos: ordem na home + revendas de cada um, expandindo inline */}
      <div className={cardClass}>
        <div className="mb-1 flex items-center gap-2">
          <Building2 size={16} className="text-teal-300" />
          <h2 className="text-sm font-semibold text-white">Empreendimentos</h2>
          {reordering ? <Loader2 size={13} className="animate-spin text-teal-300" /> : null}
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Arraste pra definir a ordem de exibição na home. Clique num empreendimento pra ver/cadastrar as revendas dele.
        </p>
        <div className="space-y-2">
          {empreendimentos.map((e) => {
            const isOpen = expandedEmpId === e.id;
            const revendas = revendasPorEmp[e.id] ?? [];
            const unidadesDisp = e.unidades_disponiveis ?? 0;
            const revendasDisp = e.revendas_disponiveis ?? 0;
            return (
              <div key={e.id} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <div
                  draggable
                  onDragStart={() => setDragEmpId(e.id)}
                  onDragOver={(ev) => ev.preventDefault()}
                  onDrop={() => onDropEmp(e.id)}
                  onClick={() => toggleExpandEmp(e.id)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                >
                  <GripVertical size={15} className="text-zinc-600 cursor-grab" onClick={(ev) => ev.stopPropagation()} />
                  {isOpen ? <ChevronDown size={15} className="text-zinc-500" /> : <ChevronRight size={15} className="text-zinc-500" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{e.nome}</p>
                    <p className="text-xs text-zinc-500">{e.cidade} · {e.origem === 'manual' ? 'manual' : 'CV CRM'}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${unidadesDisp > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-zinc-500'}`}>
                    {unidadesDisp} unid.
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${revendasDisp > 0 ? 'bg-teal-500/20 text-teal-300' : 'bg-white/5 text-zinc-500'}`}>
                    {revendasDisp} revenda{revendasDisp === 1 ? '' : 's'}
                  </span>
                </div>

                {isOpen ? (
                  <div className="border-t border-white/8 bg-black/20 px-4 py-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs text-zinc-500">
                        {loadingRevendasEmpId === e.id ? 'Carregando...' : `${revendas.length} revenda(s) cadastrada(s)`}
                      </p>
                      <button className={btnGhost} onClick={(ev) => { ev.stopPropagation(); abrirNovaRevenda(e.id); }}>
                        <Plus size={12} /> Nova revenda
                      </button>
                    </div>
                    <div className="space-y-2">
                      {revendas.map((r) => (
                        <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-white">{r.titulo}</p>
                            <p className="text-xs text-zinc-500">
                              {r.tipologia ? `${r.tipologia} · ` : ''}{r.status === 'disponivel' ? 'Disponível' : 'Vendida'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className={btnGhost} onClick={(ev) => { ev.stopPropagation(); carregarRevendaParaEdicao(r, e.id); }}>
                              <Pencil size={12} /> Editar
                            </button>
                            <a
                              href={`${SITE_BASE_URL}/${e.slug}/revenda/${r.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(ev) => ev.stopPropagation()}
                              className={btnGhost}
                            >
                              Ver <ExternalLink size={12} />
                            </a>
                            <button
                              className={`${btnGhost} text-red-300 hover:bg-red-500/15`}
                              onClick={(ev) => { ev.stopPropagation(); removerRevenda(r.id, e.id); }}
                            >
                              <Trash2 size={12} /> Remover
                            </button>
                          </div>
                        </div>
                      ))}
                      {!loadingRevendasEmpId && revendas.length === 0 ? (
                        <p className="text-xs text-zinc-600">Nenhuma revenda cadastrada pra esse empreendimento ainda.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {!loadingEmps && empreendimentos.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum empreendimento ainda.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
