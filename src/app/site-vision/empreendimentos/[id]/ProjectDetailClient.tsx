'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, Plus, Trash2, Star, Loader2 } from 'lucide-react';
import Link from 'next/link';
import logger from '@/lib/logger';

interface ProjectDetail {
  crm: {
    id: number;
    nome: string;
    situacao: string;
    tipo: string;
  };
  materiais: Array<{
    id: string;
    nome: string;
    tipo: string;
    uploadedBy: string;
  }>;
  unidades: Array<{
    id: number;
    bloco: string | null;
    numero: string | null;
    status: string | null;
    valor: number | null;
    metragem: number | null;
  }>;
  resales: Array<{
    id: string;
    titulo_publico: string;
    status_publicacao: string;
  }>;
  site: {
    publicado: boolean;
    siteProjectId: string | null;
    status_publicacao: string | null;
  };
}

interface MediaAsset {
  id: string;
  title: string;
  kind: string;
  is_primary: boolean;
  sort_order: number;
  public_url: string;
}

export function ProjectDetailClient({ projectId }: { projectId: number }) {
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [imagens, setImagens] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<Set<number>>(new Set());
  const [heroImageId, setHeroImageId] = useState<string | null>(null);

  useEffect(() => {
    const doFetch = async () => {
      try {
        setLoading(true);
        const res = await doFetch(`/api/site-vision/empreendimentos/${projectId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);

        // Se já publicado, carregar imagens
        if (json.site.publicado && json.site.siteProjectId) {
          const mediaRes = await doFetch(
            `/api/site-vision/empreendimentos/${projectId}/media`
          );
          if (mediaRes.ok) {
            const mediaJson = await mediaRes.json();
            setImagens(mediaJson.mediaAssets || []);
            const primary = mediaJson.mediaAssets?.find((m: MediaAsset) => m.is_primary);
            if (primary) setHeroImageId(primary.id);
          }
        }

        setError(null);
      } catch (err) {
        logger.error({ error: err }, '[ProjectDetailClient] fetch failed');
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projectId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const form = new FormData();
      form.append('file', file);
      form.append('altText', file.name);

      const res = await doFetch(
        `/api/site-vision/empreendimentos/${projectId}/media/upload`,
        { method: 'POST', body: form }
      );

      if (!res.ok) throw new Error('Erro no upload');
      const json = await res.json();

      setImagens((prev) => [
        ...prev,
        {
          id: json.id,
          title: json.nome,
          kind: 'image',
          is_primary: false,
          sort_order: (prev.length || 0) + 1,
          public_url: json.url,
        },
      ]);
    } catch (err) {
      logger.error({ error: err }, 'upload failed');
      alert('Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!data) return;

    try {
      setPublishing(true);
      const res = await doFetch(
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
            headlinePublico: data.crm.nome,
            descricaoCurta: data.crm.nome,
          }),
        }
      );

      if (!res.ok) throw new Error('Erro ao publicar');
      const json = await res.json();
      alert(json.message);
      window.location.reload();
    } catch (err) {
      logger.error({ error: err }, 'publish failed');
      alert('Erro ao publicar');
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
        <h2 className="text-3xl font-semibold text-white">{data.crm.nome}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {data.crm.situacao} • {data.crm.tipo} • ID {data.crm.id}
        </p>
      </div>

      {/* Status */}
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Status</p>
            <p className="mt-1 text-xs text-zinc-400">
              {data.site.publicado
                ? 'Visível no site público'
                : 'Não está publicado ainda. Clique em Publicar para começar.'}
            </p>
          </div>
          {data.site.publicado ? (
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

      {/* Imagens */}
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Imagens</h3>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">
            {imagens.length}
          </span>
        </div>

        {imagens.length > 0 && (
          <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
            {imagens
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((img) => (
                <div
                  key={img.id}
                  className={`flex items-center justify-between rounded-lg p-3 ${
                    img.is_primary ? 'bg-teal-500/20 border border-teal-400/30' : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-zinc-700 flex items-center justify-center text-xs text-zinc-400">
                      IMG
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{img.title}</p>
                      <p className="text-xs text-zinc-500">
                        {img.is_primary ? '⭐ Destaque' : `Posição ${img.sort_order}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHeroImageId(img.id)}
                    className={`p-2 rounded transition-colors ${
                      img.is_primary ? 'text-teal-300' : 'text-zinc-600 hover:text-teal-300'
                    }`}
                  >
                    <Star size={16} fill={img.is_primary ? 'currentColor' : 'none'} />
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
            {unidadesSelecionadas.size} / {data.unidades.length}
          </span>
        </div>

        {data.unidades.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma unidade cadastrada.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.unidades.slice(0, 20).map((unit) => (
              <label key={unit.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-3 cursor-pointer hover:bg-white/10">
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
            ))}
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
          {publishing ? 'Publicando...' : data.site.publicado ? 'Salvar alterações' : 'Publicar agora'}
        </button>
        <Link href="/site-vision/empreendimentos" className="rounded-lg border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors">
          Cancelar
        </Link>
      </div>
    </div>
  );
}
