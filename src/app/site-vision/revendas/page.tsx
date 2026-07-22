'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, ExternalLink, Building2, Home, Pencil, X, GripVertical, Star } from 'lucide-react';

type EmpItem = { id: number; nome: string; slug: string; cidade: string; estado: string; origem: 'cvcrm' | 'manual'; ordem: number };
type RevendaItem = { id: number; slug: string; titulo: string; preco: number | null; status: string };
type Midia = { id: number; tipo: 'foto' | 'planta' | 'documento'; url_storage: string; ordem: number; destaque?: boolean };

const SITE_BASE_URL = 'https://longview.guru.dev.br';

const inputClass = 'h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100 outline-none';
const labelClass = 'block space-y-1.5';
const labelTextClass = 'text-xs font-semibold uppercase tracking-wide text-zinc-500';
const cardClass = 'rounded-[24px] border border-white/8 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]';
const btnPrimary = 'inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait';
const btnGhost = 'inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09] text-xs font-medium transition-colors';

const emptyRevForm = {
  empreendimentoId: '', titulo: '', descricao: '', preco: '', areaPrivativa: '', areaTotal: '',
  dormitorios: '', suites: '', vagas: '', andar: '', bloco: '', posicao: '',
  corretorNome: '', corretorTelefone: '', corretorEmail: '',
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function RevendasPage() {
  const [empreendimentos, setEmpreendimentos] = useState<EmpItem[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [dragEmpId, setDragEmpId] = useState<number | null>(null);

  const [empForm, setEmpForm] = useState({ nome: '', endereco: '', cidade: '', estado: '', descricaoCurta: '' });
  const [empSaving, setEmpSaving] = useState(false);
  const [empMsg, setEmpMsg] = useState('');

  const [editingRevendaId, setEditingRevendaId] = useState<number | null>(null);
  const [revForm, setRevForm] = useState(emptyRevForm);
  const [revSaving, setRevSaving] = useState(false);
  const [revMsg, setRevMsg] = useState('');
  const [activeRevenda, setActiveRevenda] = useState<{ id: number; slug: string; empSlug: string } | null>(null);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [dragMidiaId, setDragMidiaId] = useState<number | null>(null);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const [browseEmpId, setBrowseEmpId] = useState('');
  const [browseRevendas, setBrowseRevendas] = useState<RevendaItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

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

  useEffect(() => { loadEmpreendimentos(); }, []);

  const criarEmpreendimento = async () => {
    setEmpSaving(true);
    setEmpMsg('');
    try {
      const res = await fetch('/api/site-vision/site-empreendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao criar empreendimento.');
      setEmpMsg(`Empreendimento "${json.empreendimento.nome}" criado.`);
      setEmpForm({ nome: '', endereco: '', cidade: '', estado: '', descricaoCurta: '' });
      await loadEmpreendimentos();
      setRevForm((f) => ({ ...f, empreendimentoId: String(json.empreendimento.id) }));
    } catch (error) {
      setEmpMsg(error instanceof Error ? error.message : 'Erro ao criar empreendimento.');
    } finally {
      setEmpSaving(false);
    }
  };

  // Arrastar os cards de empreendimento reordena a lista local; solta = persiste
  // a nova ordem (0,1,2...) pra cada um que mudou de posicao.
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

  const carregarRevendaParaEdicao = async (r: RevendaItem, empId: string) => {
    setRevMsg('');
    try {
      const res = await fetch(`/api/site-vision/site-revendas/by-slug/${r.slug}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar revenda.');
      const rev = json.revenda;
      setEditingRevendaId(rev.id);
      setRevForm({
        empreendimentoId: empId,
        titulo: rev.titulo || '',
        descricao: rev.descricao || '',
        preco: '',
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
      });
      const emp = empreendimentos.find((e) => String(e.id) === empId);
      setActiveRevenda({ id: rev.id, slug: rev.slug, empSlug: emp?.slug ?? rev.empreendimento?.slug ?? '' });
      setMidias(rev.midias ?? []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
  };

  const salvarRevenda = async () => {
    setRevSaving(true);
    setRevMsg('');
    try {
      const payloadBase = {
        titulo: revForm.titulo,
        descricao: revForm.descricao || undefined,
        preco: revForm.preco ? Number(revForm.preco) : null,
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
      };

      if (editingRevendaId) {
        const res = await fetch(`/api/site-vision/site-revendas/${editingRevendaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBase),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao salvar revenda.');
        setRevMsg('Alterações salvas.');
        if (browseEmpId) await carregarRevendasDoEmpreendimento(browseEmpId);
      } else {
        const payload = { ...payloadBase, empreendimentoId: Number(revForm.empreendimentoId) };
        const res = await fetch('/api/site-vision/site-revendas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao criar revenda.');
        const emp = empreendimentos.find((e) => e.id === payload.empreendimentoId);
        setActiveRevenda({ id: json.revenda.id, slug: json.revenda.slug, empSlug: emp?.slug ?? '' });
        setEditingRevendaId(json.revenda.id);
        setMidias([]);
        setRevMsg(`Revenda "${json.revenda.titulo}" criada. Agora envie as fotos abaixo.`);
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
    let ordemBase = midias.filter((m) => m.tipo === tipo).length;
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
          novas.push({ id: json.midia.id, tipo, url_storage: json.midia.url_storage, ordem: ordemBase + i });
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
    if (!confirm('Remover essa foto?')) return;
    await fetch(`/api/site-vision/site-revendas/midias/${midiaId}`, { method: 'DELETE' });
    setMidias((prev) => prev.filter((m) => m.id !== midiaId));
  };

  // Fotos marcadas como destaque entram nas secoes de foto+texto da pagina
  // conceito da revenda, no lugar da ordem padrao.
  const toggleDestaque = async (midiaId: number, atual: boolean) => {
    const novoValor = !atual;
    setMidias((prev) => prev.map((m) => (m.id === midiaId ? { ...m, destaque: novoValor } : m)));
    await fetch(`/api/site-vision/site-revendas/midias/${midiaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destaque: novoValor }),
    });
  };

  // Arrastar as fotos reordena localmente; solta = persiste a nova ordem em lote.
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

  const carregarRevendasDoEmpreendimento = async (empId: string) => {
    setBrowseEmpId(empId);
    setBrowseRevendas([]);
    if (!empId) return;
    setBrowseLoading(true);
    try {
      const res = await fetch(`/api/site-vision/site-empreendimentos/${empId}`);
      const json = await res.json();
      setBrowseRevendas(json.empreendimento?.revendas ?? []);
    } finally {
      setBrowseLoading(false);
    }
  };

  const removerRevenda = async (id: number) => {
    if (!confirm('Remover essa revenda do site? As fotos vão junto.')) return;
    await fetch(`/api/site-vision/site-revendas/${id}`, { method: 'DELETE' });
    if (editingRevendaId === id) cancelarEdicao();
    await carregarRevendasDoEmpreendimento(browseEmpId);
  };

  const fotos = midias.filter((m) => m.tipo === 'foto').sort((a, b) => a.ordem - b.ordem);
  const outrasMidias = midias.filter((m) => m.tipo !== 'foto');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-white">Revendas</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Cadastre empreendimentos que não vêm do CV CRM e as revendas (unidades já vendidas, à venda por fora) —
          cada revenda ganha uma página própria no site.
        </p>
      </div>

      {/* Ordem dos empreendimentos na home */}
      <div className={cardClass}>
        <div className="mb-1 flex items-center gap-2">
          <Building2 size={16} className="text-teal-300" />
          <h2 className="text-sm font-semibold text-white">Empreendimentos</h2>
          {reordering ? <Loader2 size={13} className="animate-spin text-teal-300" /> : null}
        </div>
        <p className="mb-4 text-xs text-zinc-500">Arraste pra definir a ordem de exibição na home do site.</p>
        <div className="space-y-2">
          {empreendimentos.map((e) => (
            <div
              key={e.id}
              draggable
              onDragStart={() => setDragEmpId(e.id)}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={() => onDropEmp(e.id)}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 cursor-grab active:cursor-grabbing"
            >
              <GripVertical size={15} className="text-zinc-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{e.nome}</p>
                <p className="text-xs text-zinc-500">{e.cidade} · {e.origem === 'manual' ? 'manual' : 'CV CRM'}</p>
              </div>
            </div>
          ))}
          {!loadingEmps && empreendimentos.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum empreendimento ainda.</p>
          ) : null}
        </div>
      </div>

      {/* Empreendimento manual */}
      <div className={cardClass}>
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-teal-300" />
          <h2 className="text-sm font-semibold text-white">Novo empreendimento manual</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={labelTextClass}>Nome</span>
            <input className={inputClass} value={empForm.nome} onChange={(e) => setEmpForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Campeche Beach Club" />
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Endereço</span>
            <input className={inputClass} value={empForm.endereco} onChange={(e) => setEmpForm((f) => ({ ...f, endereco: e.target.value }))} placeholder="Av. Pequeno Príncipe" />
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Cidade</span>
            <input className={inputClass} value={empForm.cidade} onChange={(e) => setEmpForm((f) => ({ ...f, cidade: e.target.value }))} placeholder="Florianópolis" />
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Estado (UF)</span>
            <input className={inputClass} value={empForm.estado} onChange={(e) => setEmpForm((f) => ({ ...f, estado: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="SC" maxLength={2} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>Descrição curta (opcional)</span>
            <input className={inputClass} value={empForm.descricaoCurta} onChange={(e) => setEmpForm((f) => ({ ...f, descricaoCurta: e.target.value }))} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className={btnPrimary} disabled={empSaving || !empForm.nome || !empForm.endereco || !empForm.cidade || !empForm.estado} onClick={criarEmpreendimento}>
            {empSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Criar empreendimento
          </button>
          {empMsg ? <span className="text-xs text-zinc-400">{empMsg}</span> : null}
        </div>
      </div>

      {/* Nova revenda / edição */}
      <div className={cardClass}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {editingRevendaId ? <Pencil size={16} className="text-teal-300" /> : <Home size={16} className="text-teal-300" />}
            <h2 className="text-sm font-semibold text-white">{editingRevendaId ? 'Editando revenda' : 'Nova revenda'}</h2>
          </div>
          {editingRevendaId ? (
            <button className={btnGhost} onClick={cancelarEdicao}>
              <X size={12} /> Cancelar edição
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>Empreendimento</span>
            <select
              className={inputClass}
              value={revForm.empreendimentoId}
              disabled={!!editingRevendaId}
              onChange={(e) => setRevForm((f) => ({ ...f, empreendimentoId: e.target.value }))}
            >
              <option value="">{loadingEmps ? 'Carregando...' : 'Selecione'}</option>
              {empreendimentos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} {e.origem === 'manual' ? '· manual' : '· CV CRM'}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>Título</span>
            <input className={inputClass} value={revForm.titulo} onChange={(e) => setRevForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Cobertura Duplex Reformada — 304B" />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>Descrição</span>
            <textarea
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
              rows={5}
              value={revForm.descricao}
              onChange={(e) => setRevForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </label>
          {[
            ['preco', 'Preço (R$, uso interno — não aparece no site)'],
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
          <label className={labelClass}>
            <span className={labelTextClass}>Corretor</span>
            <input className={inputClass} value={revForm.corretorNome} onChange={(e) => setRevForm((f) => ({ ...f, corretorNome: e.target.value }))} />
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>WhatsApp do corretor</span>
            <input className={inputClass} value={revForm.corretorTelefone} onChange={(e) => setRevForm((f) => ({ ...f, corretorTelefone: e.target.value }))} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className={btnPrimary} disabled={revSaving || !revForm.empreendimentoId || !revForm.titulo} onClick={salvarRevenda}>
            {revSaving ? <Loader2 size={14} className="animate-spin" /> : editingRevendaId ? <Pencil size={14} /> : <Plus size={14} />}
            {editingRevendaId ? 'Salvar alterações' : 'Criar revenda'}
          </button>
          {revMsg ? <span className="text-xs text-zinc-400">{revMsg}</span> : null}
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
                <Upload size={14} /> Enviar fotos (várias)
                <input type="file" accept="image/*" multiple hidden onChange={(e) => uploadMidias(e.target.files, 'foto')} disabled={uploadBusy} />
              </label>
              <label className={btnGhost} style={{ cursor: 'pointer' }}>
                <Upload size={14} /> Enviar planta / documento
                <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => uploadMidias(e.target.files, 'documento')} disabled={uploadBusy} />
              </label>
            </div>
            {uploadProgress ? <p className="mt-2 text-xs text-zinc-400">{uploadProgress}</p> : null}

            {fotos.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs text-zinc-500">{fotos.length} foto(s) — arraste pra reordenar, clique na estrela pra destacar na pagina do imóvel.</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {fotos.map((m) => (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={() => setDragMidiaId(m.id)}
                      onDragOver={(ev) => ev.preventDefault()}
                      onDrop={() => onDropMidia(m.id, 'foto')}
                      className="group relative aspect-square cursor-grab overflow-hidden rounded-lg border border-white/10 active:cursor-grabbing"
                    >
                      <img src={`${SITE_BASE_URL}${m.url_storage}`} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => toggleDestaque(m.id, !!m.destaque)}
                        title={m.destaque ? 'Remover destaque' : 'Marcar como destaque'}
                        className={`absolute left-1 top-1 rounded-full bg-black/70 p-1 ${m.destaque ? 'text-yellow-400' : 'hidden text-zinc-300 group-hover:block'}`}
                      >
                        <Star size={12} fill={m.destaque ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => removerMidia(m.id)}
                        className="absolute right-1 top-1 hidden rounded-full bg-black/70 p-1 text-red-300 group-hover:block"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {outrasMidias.length > 0 ? (
              <div className="mt-4 space-y-1">
                {outrasMidias.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                    <a href={`${SITE_BASE_URL}${m.url_storage}`} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-300 hover:text-white">
                      {m.tipo === 'planta' ? 'Planta' : 'Documento'}
                    </a>
                    <button onClick={() => removerMidia(m.id)} className="text-red-300 hover:text-red-200">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Navegar revendas existentes */}
      <div className={cardClass}>
        <h2 className="mb-4 text-sm font-semibold text-white">Revendas existentes</h2>
        <select className={`${inputClass} sm:max-w-sm`} value={browseEmpId} onChange={(e) => carregarRevendasDoEmpreendimento(e.target.value)}>
          <option value="">Selecione um empreendimento</option>
          {empreendimentos.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>

        {browseLoading ? <p className="mt-4 text-sm text-zinc-500">Carregando...</p> : null}

        {!browseLoading && browseEmpId && browseRevendas.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nenhuma revenda cadastrada pra esse empreendimento.</p>
        ) : null}

        <div className="mt-4 space-y-2">
          {browseRevendas.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">{r.titulo}</p>
                <p className="text-xs text-zinc-500">{r.status === 'disponivel' ? 'Disponível' : 'Vendida'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className={btnGhost} onClick={() => carregarRevendaParaEdicao(r, browseEmpId)}>
                  <Pencil size={12} /> Editar
                </button>
                <a
                  href={`${SITE_BASE_URL}/${empreendimentos.find((e) => String(e.id) === browseEmpId)?.slug ?? ''}/revenda/${r.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnGhost}
                >
                  Ver <ExternalLink size={12} />
                </a>
                <button className={`${btnGhost} text-red-300 hover:bg-red-500/15`} onClick={() => removerRevenda(r.id)}>
                  <Trash2 size={12} /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
