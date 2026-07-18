'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, Plus, Star, Loader2 } from 'lucide-react';
import Link from 'next/link';
import logger from '@/lib/logger';

interface ProjectDetail {
  empreendimento: {
    id: number;
    nome: string;
    situacao: string | null;
    tipo: string | null;
    segmento: string | null;
    cidade: string | null;
    bairro: string | null;
    estado: string | null;
    endereco: string | null;
    dataEntrega: string | null;
    andamento: number | null;
  };
  siteConfig: {
    id: string;
    status: 'draft' | 'published' | 'archived';
    enabled: boolean;
    resumo: string;
    descricao: string;
    metadata: {
      logoUrl?: string;
      videoUrl?: string;
      vagasLabel?: string;
    };
  } | null;
  specs: {
    areaMin: number | null;
    areaMax: number | null;
    dormitoriosMin: number | null;
    dormitoriosMax: number | null;
    andares: number | null;
  };
  units: Array<{
    id: number;
    bloco: string | null;
    numero: string | null;
    status: string | null;
    valor: number | null;
    metragem: number | null;
    siteVisible: boolean;
    resale: {
      id: string;
      status_publicacao: string;
      titulo_publico: string;
      preco_revenda: number | null;
    } | null;
  }>;
  materials: Array<{
    id: string;
    nome: string;
    tipo: string;
    sizeBytes?: number | null;
    downloadUrl: string;
    fonte: 'cvcrm' | 'manual';
  }>;
  publishedMateriais: Array<{
    id: number;
    tipo: string;
    origem: string;
    titulo: string;
    url_storage: string;
  }>;
  mediaAssets: Array<{
    id: string;
    title: string;
    kind: string;
    isPrimary: boolean;
    sortOrder: number;
    publicUrl: string;
  }>;
}

function formatDataEntrega(value: string | null) {
  if (!value) return 'Não informado';
  // CV CRM manda DD/MM/YYYY — já está no formato certo, só normaliza se vier ISO.
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
}

function formatSpecRange(min: number | null, max: number | null) {
  if (min == null && max == null) return 'Sem unidades cadastradas';
  const lo = min ?? max;
  const hi = max ?? min;
  return lo === hi ? String(lo) : `${lo}-${hi}`;
}

export function ProjectDetailClient({ projectId }: { projectId: number }) {
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<Set<number>>(new Set());
  const [heroImageId, setHeroImageId] = useState<string | null>(null);
  const [revendaBusy, setRevendaBusy] = useState<number | string | null>(null);
  const [contentForm, setContentForm] = useState({
    shortDescription: '',
    descricao: '',
    logoUrl: '',
    videoUrl: '',
    vagasLabel: '',
  });
  const [savingContent, setSavingContent] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);
  const [materiaisBusy, setMateriaisBusy] = useState('');

  const loadDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/site-vision/empreendimentos/${projectId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ProjectDetail;
      setData(json);
      setUnidadesSelecionadas(new Set(json.units.filter((u) => u.siteVisible).map((u) => u.id)));
      const primary = json.mediaAssets.find((m) => m.isPrimary);
      if (primary) setHeroImageId(primary.id);
      setContentForm({
        shortDescription: json.siteConfig?.resumo ?? '',
        descricao: json.siteConfig?.descricao ?? '',
        logoUrl: json.siteConfig?.metadata?.logoUrl ?? '',
        videoUrl: json.siteConfig?.metadata?.videoUrl ?? '',
        vagasLabel: json.siteConfig?.metadata?.vagasLabel ?? '',
      });
      setError(null);
    } catch (err) {
      logger.error({ error: err }, '[ProjectDetailClient] fetch failed');
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const publishedTitles = new Set((data?.publishedMateriais ?? []).map((m) => m.titulo));

  const publishMaterial = async (material: ProjectDetail['materials'][number]) => {
    if (!data) return;
    setMateriaisBusy(material.id);
    setError(null);
    try {
      const res = await fetch(`/api/site-vision/empreendimentos/${projectId}/materiais`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: material.tipo === 'planta' ? 'planta' : 'material',
          titulo: material.nome,
          url: material.downloadUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao publicar material.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar material.');
    } finally {
      setMateriaisBusy('');
    }
  };

  const removeMaterial = async (materialId: number) => {
    if (!data) return;
    setMateriaisBusy(`remove-${materialId}`);
    setError(null);
    try {
      const res = await fetch(`/api/site-vision/empreendimentos/${projectId}/materiais`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao remover material.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover material.');
    } finally {
      setMateriaisBusy('');
    }
  };

  const uploadManualMaterial = async (file: File, tipo: 'material' | 'planta' | 'ebook') => {
    if (!data) return;
    setMateriaisBusy('uploading');
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/site-vision/empreendimentos/${projectId}/materiais`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, titulo: file.name, dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao enviar material.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar material.');
    } finally {
      setMateriaisBusy('');
    }
  };

  const transformarEmRevenda = async (unit: ProjectDetail['units'][number]) => {
    if (!data) return;
    const precoStr = window.prompt(`Valor pedido pela revenda da unidade ${unit.numero ?? unit.id} (R$):`, unit.valor ? String(unit.valor) : '');
    if (precoStr === null) return;
    const preco = precoStr.trim() ? Number(precoStr.replace(/[^\d.,]/g, '').replace(',', '.')) : null;

    setRevendaBusy(unit.id);
    setError(null);
    try {
      const res = await fetch('/api/site-vision/revendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvUnidadeId: unit.id,
          cvEmpreendimentoId: data.empreendimento.id,
          title: `Revenda ${data.empreendimento.nome} - Unidade ${unit.numero ?? unit.id}`,
          price: preco,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao criar revenda.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar revenda.');
    } finally {
      setRevendaBusy(null);
    }
  };

  const disponibilizarRevenda = async (resaleId: string) => {
    if (!data) return;
    setRevendaBusy(resaleId);
    setError(null);
    try {
      const res = await fetch(`/api/site-vision/empreendimentos/${projectId}/revendas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resaleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao disponibilizar revenda.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao disponibilizar revenda.');
    } finally {
      setRevendaBusy(null);
    }
  };

  const removerRevendaDoSite = async (resaleId: string) => {
    if (!data) return;
    setRevendaBusy(resaleId);
    setError(null);
    try {
      const res = await fetch(`/api/site-vision/empreendimentos/${projectId}/revendas`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resaleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao remover revenda do site.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover revenda do site.');
    } finally {
      setRevendaBusy(null);
    }
  };

  const saveContent = async () => {
    setSavingContent(true);
    setContentSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/site-vision/empreendimentos/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortDescription: contentForm.shortDescription,
          descricao: contentForm.descricao,
          logoUrl: contentForm.logoUrl,
          videoUrl: contentForm.videoUrl,
          vagasLabel: contentForm.vagasLabel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao salvar conteúdo.');
      setContentSaved(true);
    } catch (err) {
      logger.error({ error: err }, '[ProjectDetailClient] save content failed');
      setError(err instanceof Error ? err.message : 'Erro ao salvar conteúdo.');
    } finally {
      setSavingContent(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;

    try {
      setUploading(true);
      const form = new FormData();
      form.append('file', file);
      form.append('altText', file.name);

      const res = await fetch(
        `/api/site-vision/empreendimentos/${projectId}/media/upload`,
        { method: 'POST', body: form }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro no upload');
      }
      const json = await res.json();

      setData({
        ...data,
        mediaAssets: [
          ...data.mediaAssets,
          {
            id: json.id,
            title: json.nome,
            kind: 'image',
            isPrimary: false,
            sortOrder: data.mediaAssets.length + 1,
            publicUrl: json.url,
          },
        ],
      });
    } catch (err) {
      logger.error({ error: err }, 'upload failed');
      alert(err instanceof Error ? err.message : 'Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!data) return;

    try {
      setPublishing(true);
      const res = await fetch(
        `/api/site-vision/empreendimentos/${projectId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'published',
            exibirNaHome: true,
            destaque: false,
            heroImageId,
            unidadesVisiveis: Array.from(unidadesSelecionadas),
            headlinePublico: data.empreendimento.nome,
            descricaoCurta: data.empreendimento.nome,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao publicar');
      alert(json.message);
      window.location.reload();
    } catch (err) {
      logger.error({ error: err }, 'publish failed');
      alert(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-zinc-400">Carregando detalhes...</div>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/site-vision/empreendimentos"
          className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300"
        >
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6">
          <div className="flex gap-4">
            <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-200">
                {error || 'Não foi possível carregar o empreendimento'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const publicado = data.siteConfig?.enabled === true;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/site-vision/empreendimentos"
          className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 mb-4"
        >
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <h2 className="text-3xl font-semibold text-white">{data.empreendimento.nome}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {data.empreendimento.situacao} • {data.empreendimento.tipo} • ID {data.empreendimento.id}
        </p>
      </div>

      {/* Dados do CRM */}
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
        <h3 className="text-base font-semibold text-white mb-4">Dados do CRM</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-zinc-500">Endereço</p>
            <p className="mt-1 text-sm text-zinc-200">
              {[data.empreendimento.endereco, data.empreendimento.bairro, data.empreendimento.cidade, data.empreendimento.estado].filter(Boolean).join(', ') || 'Não informado'}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Segmento</p>
            <p className="mt-1 text-sm text-zinc-200">{data.empreendimento.segmento || 'Não informado'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Data de entrega</p>
            <p className="mt-1 text-sm text-zinc-200">
              {formatDataEntrega(data.empreendimento.dataEntrega)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Andamento da obra</p>
            <p className="mt-1 text-sm text-zinc-200">{data.empreendimento.andamento != null ? `${data.empreendimento.andamento}%` : 'Não informado'}</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Status</p>
            <p className="mt-1 text-xs text-zinc-400">
              {publicado
                ? 'Visível no site público'
                : 'Não está publicado ainda. Clique em Publicar para começar.'}
            </p>
          </div>
          {publicado ? (
            <span className="rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300">
              Publicado
            </span>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {publishing ? <Loader2 className="animate-spin inline mr-2" size={16} /> : ''}
              Publicar agora
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo do site */}
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Conteúdo do site</h3>
          {contentSaved ? <span className="text-xs font-semibold text-emerald-300">Salvo no site real ✓</span> : null}
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Descrição curta (card)</span>
          <textarea
            rows={2}
            value={contentForm.shortDescription}
            onChange={(e) => { setContentForm((f) => ({ ...f, shortDescription: e.target.value })); setContentSaved(false); }}
            placeholder="Texto que aparece no card do empreendimento na home"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Descrição completa (página de detalhe)</span>
          <textarea
            rows={5}
            value={contentForm.descricao}
            onChange={(e) => { setContentForm((f) => ({ ...f, descricao: e.target.value })); setContentSaved(false); }}
            placeholder="Texto completo exibido na página do empreendimento"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">URL do logo</span>
            <input
              value={contentForm.logoUrl}
              onChange={(e) => { setContentForm((f) => ({ ...f, logoUrl: e.target.value })); setContentSaved(false); }}
              placeholder="https://..."
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100 outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">URL do vídeo (embed)</span>
            <input
              value={contentForm.videoUrl}
              onChange={(e) => { setContentForm((f) => ({ ...f, videoUrl: e.target.value })); setContentSaved(false); }}
              placeholder="https://www.youtube.com/embed/..."
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100 outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1.5 sm:max-w-xs">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vagas de garagem</span>
          <input
            value={contentForm.vagasLabel}
            onChange={(e) => { setContentForm((f) => ({ ...f, vagasLabel: e.target.value })); setContentSaved(false); }}
            placeholder="Ex: 1-3"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100 outline-none"
          />
        </label>

        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-300 mb-1">Especificações (calculadas automaticamente pelas unidades)</p>
          <p>Área privativa: {formatSpecRange(data.specs.areaMin, data.specs.areaMax)}{data.specs.areaMin != null ? ' m²' : ''}</p>
          <p>Dormitórios: {formatSpecRange(data.specs.dormitoriosMin, data.specs.dormitoriosMax)}</p>
          <p>Andares: {data.specs.andares ?? 'Sem unidades cadastradas'}</p>
        </div>

        <button
          onClick={saveContent}
          disabled={savingContent}
          className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {savingContent ? <Loader2 className="animate-spin inline mr-2" size={16} /> : ''}
          Salvar conteúdo
        </button>
      </div>

      {/* Materiais */}
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-white">Materiais e plantas</h3>
          <p className="mt-1 text-xs text-zinc-400">
            O que já vem pronto do CV CRM aparece abaixo — só clicar em publicar. Também dá pra enviar um PDF/imagem manualmente.
          </p>
        </div>

        {data.materials.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum material do CRM encontrado pra este empreendimento.</p>
        ) : (
          <div className="space-y-2">
            {data.materials.map((material) => {
              const isPublished = publishedTitles.has(material.nome);
              return (
                <div key={material.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{material.nome}</p>
                    <p className="text-xs text-zinc-500">
                      {material.tipo} • {material.fonte === 'cvcrm' ? 'CV CRM' : 'Manual'}
                    </p>
                  </div>
                  <button
                    onClick={() => publishMaterial(material)}
                    disabled={isPublished || materiaisBusy === material.id}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                      isPublished ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white hover:bg-white/15'
                    } disabled:opacity-60`}
                  >
                    {materiaisBusy === material.id ? <Loader2 className="animate-spin inline mr-1" size={13} /> : ''}
                    {isPublished ? 'Publicado' : 'Publicar no site'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {(data.publishedMateriais ?? []).length > 0 && (
          <div className="border-t border-white/8 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Publicados no site</p>
            <div className="space-y-2">
              {data.publishedMateriais.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
                  <p className="truncate text-sm text-zinc-200">{item.titulo}</p>
                  <button
                    onClick={() => removeMaterial(item.id)}
                    disabled={materiaisBusy === `remove-${item.id}`}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors cursor-pointer">
            <Plus size={16} />
            {materiaisBusy === 'uploading' ? 'Enviando...' : 'Enviar material manual (PDF/imagem)'}
          </span>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadManualMaterial(file, 'material');
              e.target.value = '';
            }}
            disabled={materiaisBusy === 'uploading'}
            className="hidden"
          />
        </label>
      </div>

      {/* Imagens */}
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Imagens</h3>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">
            {data.mediaAssets.length}
          </span>
        </div>

        {data.mediaAssets.length > 0 && (
          <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
            {[...data.mediaAssets]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((img) => (
                <div
                  key={img.id}
                  className={`flex items-center justify-between rounded-lg p-3 ${
                    img.id === heroImageId ? 'bg-teal-500/20 border border-teal-400/30' : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 overflow-hidden">
                      {img.publicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.publicUrl} alt={img.title} className="h-full w-full object-cover" />
                      ) : (
                        'IMG'
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{img.title}</p>
                      <p className="text-xs text-zinc-500">
                        {img.id === heroImageId ? '⭐ Destaque' : `Posição ${img.sortOrder}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHeroImageId(img.id)}
                    className={`p-2 rounded transition-colors ${
                      img.id === heroImageId ? 'text-teal-300' : 'text-zinc-600 hover:text-teal-300'
                    }`}
                  >
                    <Star size={16} fill={img.id === heroImageId ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
          </div>
        )}

        <label className="block">
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors cursor-pointer">
            <Plus size={16} />
            {uploading ? 'Enviando...' : 'Adicionar imagens'}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Unidades */}
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Unidades a publicar</h3>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">
            {unidadesSelecionadas.size} / {data.units.length}
          </span>
        </div>

        {data.units.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma unidade cadastrada.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.units.map((unit) => {
              const vendida = (unit.status ?? '').toLowerCase().includes('vend');
              return (
                <div key={unit.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10">
                  <label className="flex flex-1 items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unidadesSelecionadas.has(unit.id)}
                      onChange={(e) => {
                        const newSet = new Set(unidadesSelecionadas);
                        if (e.target.checked) {
                          newSet.add(unit.id);
                        } else {
                          newSet.delete(unit.id);
                        }
                        setUnidadesSelecionadas(newSet);
                      }}
                      className="h-4 w-4 rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {unit.bloco && `Bloco ${unit.bloco}`} {unit.numero && `Apto ${unit.numero}`}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {unit.status} • {unit.metragem}m²
                      </p>
                    </div>
                  </label>

                  {vendida && !unit.resale && (
                    <button
                      onClick={() => transformarEmRevenda(unit)}
                      disabled={revendaBusy === unit.id}
                      className="shrink-0 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-60"
                    >
                      {revendaBusy === unit.id ? <Loader2 className="animate-spin inline mr-1" size={12} /> : ''}
                      Transformar em revenda
                    </button>
                  )}

                  {unit.resale && unit.resale.status_publicacao !== 'published' && (
                    <button
                      onClick={() => disponibilizarRevenda(unit.resale!.id)}
                      disabled={revendaBusy === unit.resale.id}
                      className="shrink-0 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                    >
                      {revendaBusy === unit.resale.id ? <Loader2 className="animate-spin inline mr-1" size={12} /> : ''}
                      Disponibilizar no site
                    </button>
                  )}

                  {unit.resale && unit.resale.status_publicacao === 'published' && (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                        Revenda no site
                      </span>
                      <button
                        onClick={() => removerRevendaDoSite(unit.resale!.id)}
                        disabled={revendaBusy === unit.resale.id}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex-1 rounded-lg bg-teal-600 px-6 py-3 text-center font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {publishing ? 'Publicando...' : publicado ? 'Salvar alterações' : 'Publicar agora'}
        </button>
        <Link href="/site-vision/empreendimentos" className="rounded-lg border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors">
          Cancelar
        </Link>
      </div>
    </div>
  );
}
