'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Home,
  ImagePlus,
  Loader2,
  MapPinned,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
} from 'lucide-react';

type SiteConfig = {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  enabled: boolean;
  showOnHome: boolean;
  destaque: boolean;
  heroImageUrl: string;
  headline: string;
  resumo: string;
  descricao: string;
  ctaLabel: string;
  ctaTarget: string;
  tags: string[];
  highlights: string[];
  metadata: Record<string, unknown>;
};

type SiteProjectMetadata = {
  displayName?: string;
  shortDescription?: string;
  locationLabel?: string;
  addressLine?: string;
  stageLabel?: string;
  deliveryLabel?: string;
  areaLabel?: string;
  bedroomsLabel?: string;
  suitesLabel?: string;
  parkingLabel?: string;
  floorsLabel?: string;
  unitsLabel?: string;
  cardHeroImageUrl?: string;
  detailHeroImageUrl?: string;
  logoUrl?: string;
  heroVideoUrl?: string;
  cardVideoUrl?: string;
  whatsappNumber?: string;
  clientPortalUrl?: string;
  technicalAssistUrl?: string;
  videoUrl?: string;
};

type DetailPayload = {
  empreendimento: {
    id: number;
    nome: string;
    situacao: string | null;
    tipo: string | null;
    foto: string | null;
    logo: string | null;
    imageUrl: string | null;
    linkDisponibilidade: string | null;
    segmento: string | null;
    cidade: string | null;
    bairro: string | null;
    estado: string | null;
    endereco: string | null;
    dataEntrega: string | null;
    andamento: number | null;
  };
  crmMedia: Array<{
    id: string;
    kind: string;
    origin: string;
    title: string;
    publicUrl: string;
    thumbnailUrl: string;
  }>;
  siteConfig: SiteConfig | null;
  counts: {
    total: number;
    available: number;
    reserved: number;
    sold: number;
  };
  units: Array<{
    id: number;
    bloco: string | null;
    numero: string | null;
    status: string | null;
    statusVenda: number | null;
    valor: number | null;
    metragem: number | null;
    andar: string | null;
    coluna: string | null;
    tipologia: string | null;
    siteVisible: boolean;
    owner: {
      reservaId: number;
      name: string;
      email: string;
      phone: string;
      document: string;
      brokerName: string;
      brokerEmail: string;
      status: string;
      saleValue: number | null;
      soldAt: string | null;
    } | null;
    resale: {
      id: string;
      cv_unidade_id: number;
      status_publicacao: string;
      titulo_publico: string;
      preco_revenda: number | null;
      corretor_nome: string;
      owner_name: string;
    } | null;
    raw: Record<string, unknown>;
  }>;
  materials: Array<{
    id: string;
    nome: string;
    tipo: string;
    sizeBytes?: number | null;
    downloadUrl: string;
    fonte: 'cvcrm' | 'manual';
  }>;
  internalTables: Array<{
    id: string;
    title: string;
    versionLabel: string;
    mimeType: string | null;
    sizeBytes: number | null;
    publicUrl: string;
    createdAt: string;
  }>;
  mediaAssets: Array<{
    id: string;
    kind: string;
    origin: string;
    title: string;
    altText: string;
    publicUrl: string;
    thumbnailUrl: string;
    mimeType: string;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    isPrimary: boolean;
    sortOrder: number;
    metadata: Record<string, unknown>;
  }>;
  gatedAssets: Array<{
    id: string;
    title: string;
    slug: string;
    type: 'ebook' | 'brochure' | 'document';
    publicUrl: string;
    thumbnailUrl: string;
    mimeType: string;
    sizeBytes: number | null;
    active: boolean;
    leadTag: string;
    metadata: Record<string, unknown>;
  }>;
  resales: Array<{
    id: string;
    cv_unidade_id: number;
    status_publicacao: string;
    titulo_publico: string;
    preco_revenda: number | null;
    corretor_nome: string;
    owner_name: string;
  }>;
};

type TabKey = 'visao-geral' | 'conteudo' | 'galeria' | 'materiais' | 'unidades' | 'revendas';

function money(value: number | null) {
  if (value == null) return 'Nao informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function bytes(value?: number | null) {
  if (!value) return 'Sem tamanho';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(status: string | null) {
  const value = (status ?? '').toLowerCase();
  if (value.includes('disp')) return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300';
  if (value.includes('res')) return 'border-amber-400/20 bg-amber-500/10 text-amber-200';
  if (value.includes('vend')) return 'border-sky-400/20 bg-sky-500/10 text-sky-300';
  return 'border-zinc-400/20 bg-zinc-500/10 text-zinc-300';
}

function isSoldUnit(unit: DetailPayload['units'][number]) {
  const status = (unit.status ?? '').toLowerCase();
  return status.includes('vend') || unit.statusVenda === 3;
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function pickRawValue(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (value == null) continue;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function parseNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatArea(value: unknown) {
  const parsed = parseNumber(value);
  if (parsed == null || parsed <= 0) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function parseLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string | null) {
  if (!value) return 'Nao informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.025] p-8 text-sm text-zinc-500">{text}</div>;
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="mb-5">
        <p className="text-sm font-semibold text-white">{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none"
    />
  );
}

function Textarea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-100 outline-none"
    />
  );
}

export function EmpreendimentoWorkspace({ empreendimentoId }: { empreendimentoId: number }) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('visao-geral');
  const [filter, setFilter] = useState<'all' | 'available' | 'reserved' | 'sold'>('all');
  const [savingConfig, setSavingConfig] = useState(false);
  const [togglingUnitId, setTogglingUnitId] = useState<number | null>(null);
  const [revendaTarget, setRevendaTarget] = useState<DetailPayload['units'][number] | null>(null);
  const [ownerMode, setOwnerMode] = useState<'keep' | 'update'>('keep');
  const [revendaBusy, setRevendaBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState('');
  const [gatedBusy, setGatedBusy] = useState(false);
  const [draggingMediaId, setDraggingMediaId] = useState<string | null>(null);
  const [editorialForm, setEditorialForm] = useState({
    slug: '',
    displayName: '',
    headline: '',
    shortDescription: '',
    locationLabel: '',
    addressLine: '',
    stageLabel: '',
    deliveryLabel: '',
    resumo: '',
    descricao: '',
    areaLabel: '',
    bedroomsLabel: '',
    suitesLabel: '',
    parkingLabel: '',
    floorsLabel: '',
    unitsLabel: '',
    ctaLabel: '',
    ctaTarget: '',
    heroImageUrl: '',
    cardHeroImageUrl: '',
    detailHeroImageUrl: '',
    logoUrl: '',
    videoUrl: '',
    heroVideoUrl: '',
    cardVideoUrl: '',
    whatsappNumber: '',
    clientPortalUrl: '',
    technicalAssistUrl: '',
    tagsText: '',
    highlightsText: '',
  });
  const [mediaForm, setMediaForm] = useState({
    kind: 'image',
    title: '',
    publicUrl: '',
    thumbnailUrl: '',
    altText: '',
  });
  const [gatedForm, setGatedForm] = useState({
    title: '',
    type: 'ebook',
    publicUrl: '',
    thumbnailUrl: '',
    leadTag: 'ebook',
  });
  const [revendaForm, setRevendaForm] = useState({
    title: '',
    price: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerDocument: '',
    brokerName: '',
    brokerEmail: '',
  });

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/site-vision/empreendimentos/${empreendimentoId}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao carregar empreendimento.');
      setDetail(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar empreendimento.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [empreendimentoId]);

  useEffect(() => {
    if (!detail) return;
    const config = detail.siteConfig;
    const metadata = (config?.metadata ?? {}) as SiteProjectMetadata;
    const defaultLocation = [detail.empreendimento.bairro, detail.empreendimento.cidade].filter(Boolean).join(' • ');
    const defaultAddress = [detail.empreendimento.endereco, detail.empreendimento.bairro, detail.empreendimento.cidade, detail.empreendimento.estado].filter(Boolean).join(' • ');
    setEditorialForm({
      slug: config?.slug ?? `empreendimento-${detail.empreendimento.id}`,
      displayName: safeString(metadata.displayName) || detail.empreendimento.nome,
      headline: config?.headline ?? detail.empreendimento.nome,
      shortDescription: safeString(metadata.shortDescription) || config?.headline || '',
      locationLabel: safeString(metadata.locationLabel) || defaultLocation,
      addressLine: safeString(metadata.addressLine) || defaultAddress,
      stageLabel: safeString(metadata.stageLabel) || detail.empreendimento.situacao || '',
      deliveryLabel: safeString(metadata.deliveryLabel) || (detail.empreendimento.dataEntrega ? formatDate(detail.empreendimento.dataEntrega) : ''),
      resumo: config?.resumo ?? '',
      descricao: config?.descricao ?? '',
      areaLabel: safeString(metadata.areaLabel),
      bedroomsLabel: safeString(metadata.bedroomsLabel),
      suitesLabel: safeString(metadata.suitesLabel),
      parkingLabel: safeString(metadata.parkingLabel),
      floorsLabel: safeString(metadata.floorsLabel),
      unitsLabel: safeString(metadata.unitsLabel),
      ctaLabel: config?.ctaLabel ?? 'Quero saber mais',
      ctaTarget: config?.ctaTarget ?? '',
      heroImageUrl: config?.heroImageUrl ?? detail.empreendimento.imageUrl ?? '',
      cardHeroImageUrl: safeString(metadata.cardHeroImageUrl),
      detailHeroImageUrl: safeString(metadata.detailHeroImageUrl),
      logoUrl: safeString(metadata.logoUrl) || detail.empreendimento.logo || '',
      videoUrl: safeString(metadata.videoUrl),
      heroVideoUrl: safeString(metadata.heroVideoUrl),
      cardVideoUrl: safeString(metadata.cardVideoUrl),
      whatsappNumber: safeString(metadata.whatsappNumber),
      clientPortalUrl: safeString(metadata.clientPortalUrl),
      technicalAssistUrl: safeString(metadata.technicalAssistUrl),
      tagsText: (config?.tags ?? []).join('\n'),
      highlightsText: (config?.highlights ?? []).join('\n'),
    });
  }, [detail]);

  const filteredUnits = useMemo(() => {
    if (!detail) return [];
    return detail.units.filter((unit) => {
      const status = (unit.status ?? '').toLowerCase();
      if (filter === 'available') return status.includes('disp') || unit.statusVenda === 1;
      if (filter === 'reserved') return status.includes('res') || unit.statusVenda === 2;
      if (filter === 'sold') return status.includes('vend') || unit.statusVenda === 3;
      return true;
    });
  }, [detail, filter]);

  const resaleCandidates = useMemo(() => {
    if (!detail) return [];
    return detail.units.filter((unit) => isSoldUnit(unit) && !unit.resale);
  }, [detail]);

  const heroPreview = editorialForm.heroImageUrl || detail?.empreendimento.imageUrl || '';

  const resolveUnitPrice = (unit: DetailPayload['units'][number]) => {
    const rawPrice = parseNumber(unit.raw.valor ?? unit.raw.valor_venda ?? unit.raw.preco ?? unit.raw.preco_tabela);
    return unit.valor ?? rawPrice ?? unit.owner?.saleValue ?? null;
  };

  const saveConfig = async (patch?: Partial<{
    enabled: boolean;
    showOnHome: boolean;
    destaque: boolean;
    slug: string;
    headline: string;
    displayName: string;
    shortDescription: string;
    locationLabel: string;
    addressLine: string;
    stageLabel: string;
    deliveryLabel: string;
    resumo: string;
    descricao: string;
    heroImageUrl: string;
    cardHeroImageUrl: string;
    detailHeroImageUrl: string;
    logoUrl: string;
    ctaLabel: string;
    ctaTarget: string;
    areaLabel: string;
    bedroomsLabel: string;
    suitesLabel: string;
    parkingLabel: string;
    floorsLabel: string;
    unitsLabel: string;
    tags: string[];
    highlights: string[];
    videoUrl: string;
    heroVideoUrl: string;
    cardVideoUrl: string;
    whatsappNumber: string;
    clientPortalUrl: string;
    technicalAssistUrl: string;
  }>) => {
    if (!detail) return;
    setSavingConfig(true);
    setError('');
    try {
      const payload = patch ?? {
        slug: editorialForm.slug,
        displayName: editorialForm.displayName,
        headline: editorialForm.headline,
        shortDescription: editorialForm.shortDescription,
        locationLabel: editorialForm.locationLabel,
        addressLine: editorialForm.addressLine,
        stageLabel: editorialForm.stageLabel,
        deliveryLabel: editorialForm.deliveryLabel,
        resumo: editorialForm.resumo,
        descricao: editorialForm.descricao,
        heroImageUrl: editorialForm.heroImageUrl,
        cardHeroImageUrl: editorialForm.cardHeroImageUrl,
        detailHeroImageUrl: editorialForm.detailHeroImageUrl,
        logoUrl: editorialForm.logoUrl,
        ctaLabel: editorialForm.ctaLabel,
        ctaTarget: editorialForm.ctaTarget,
        areaLabel: editorialForm.areaLabel,
        bedroomsLabel: editorialForm.bedroomsLabel,
        suitesLabel: editorialForm.suitesLabel,
        parkingLabel: editorialForm.parkingLabel,
        floorsLabel: editorialForm.floorsLabel,
        unitsLabel: editorialForm.unitsLabel,
        tags: parseLines(editorialForm.tagsText),
        highlights: parseLines(editorialForm.highlightsText),
        videoUrl: editorialForm.videoUrl,
        heroVideoUrl: editorialForm.heroVideoUrl,
        cardVideoUrl: editorialForm.cardVideoUrl,
        whatsappNumber: editorialForm.whatsappNumber,
        clientPortalUrl: editorialForm.clientPortalUrl,
        technicalAssistUrl: editorialForm.technicalAssistUrl,
      };

      const response = await fetch(`/api/site-vision/empreendimentos/${detail.empreendimento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao atualizar empreendimento.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar empreendimento.');
    } finally {
      setSavingConfig(false);
    }
  };

  const addMedia = async () => {
    if (!detail) return;
    setMediaBusy('creating');
    setError('');
    try {
      const response = await fetch(`/api/site-vision/empreendimentos/${detail.empreendimento.id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaForm),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao cadastrar mídia.');
      setMediaForm({ kind: 'image', title: '', publicUrl: '', thumbnailUrl: '', altText: '' });
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar mídia.');
    } finally {
      setMediaBusy('');
    }
  };

  const updateMedia = async (mediaId: string, action: 'primary' | 'up' | 'down' | 'delete') => {
    if (!detail) return;
    setMediaBusy(`${action}-${mediaId}`);
    setError('');
    try {
      const response = await fetch(`/api/site-vision/empreendimentos/${detail.empreendimento.id}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId, action }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao atualizar mídia.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar mídia.');
    } finally {
      setMediaBusy('');
    }
  };

  const reorderMedia = async (orderedIds: string[]) => {
    if (!detail || orderedIds.length === 0) return;
    setMediaBusy('reordering');
    setError('');
    try {
      const response = await fetch(`/api/site-vision/empreendimentos/${detail.empreendimento.id}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', orderedIds }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao reordenar mídia.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reordenar mídia.');
    } finally {
      setMediaBusy('');
      setDraggingMediaId(null);
    }
  };

  const uploadMediaFile = async (file: File) => {
    if (!detail) return;
    setMediaBusy('uploading');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: form,
      });
      const uploadJson = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadJson?.error || 'Erro ao enviar arquivo.');

      const guessedKind = file.type.startsWith('image/')
        ? mediaForm.kind === 'floorplan' || mediaForm.kind === 'logo'
          ? mediaForm.kind
          : 'image'
        : 'document';

      const mediaResponse = await fetch(`/api/site-vision/empreendimentos/${detail.empreendimento.id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: guessedKind,
          title: mediaForm.title || file.name,
          publicUrl: uploadJson.url,
          thumbnailUrl: uploadJson.url,
          altText: mediaForm.altText || mediaForm.title || file.name,
          mimeType: file.type,
          origin: 'upload',
        }),
      });
      const mediaJson = await mediaResponse.json();
      if (!mediaResponse.ok) throw new Error(mediaJson?.error || 'Erro ao cadastrar mídia enviada.');

      setMediaForm((current) => ({
        ...current,
        title: '',
        publicUrl: '',
        thumbnailUrl: '',
        altText: '',
      }));
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mídia.');
    } finally {
      setMediaBusy('');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const addGatedAsset = async () => {
    if (!detail) return;
    setGatedBusy(true);
    setError('');
    try {
      await saveConfig({
        slug: editorialForm.slug,
        headline: editorialForm.headline,
        resumo: editorialForm.resumo,
        descricao: editorialForm.descricao,
        heroImageUrl: editorialForm.heroImageUrl,
        ctaLabel: editorialForm.ctaLabel,
        ctaTarget: editorialForm.ctaTarget,
        tags: parseLines(editorialForm.tagsText),
        highlights: parseLines(editorialForm.highlightsText),
        videoUrl: editorialForm.videoUrl,
      });
      const response = await fetch(`/api/site-vision/empreendimentos/${detail.empreendimento.id}/gated-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gatedForm),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao cadastrar e-book/material.');
      setGatedForm({ title: '', type: 'ebook', publicUrl: '', thumbnailUrl: '', leadTag: 'ebook' });
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar e-book/material.');
    } finally {
      setGatedBusy(false);
    }
  };

  const toggleGatedAsset = async (assetId: string, active: boolean) => {
    if (!detail) return;
    setGatedBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/site-vision/empreendimentos/${detail.empreendimento.id}/gated-assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, active }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao atualizar material.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar material.');
    } finally {
      setGatedBusy(false);
    }
  };

  const openRevenda = (unit: DetailPayload['units'][number]) => {
    const price = resolveUnitPrice(unit);
    setRevendaTarget(unit);
    setOwnerMode('keep');
    setRevendaForm({
      title: `Revenda ${detail?.empreendimento.nome ?? ''} ${unit.numero ? `- Unidade ${unit.numero}` : ''}`.trim(),
      price: price != null ? String(price) : '',
      ownerName: unit.owner?.name ?? '',
      ownerEmail: unit.owner?.email ?? '',
      ownerPhone: unit.owner?.phone ?? '',
      ownerDocument: unit.owner?.document ?? '',
      brokerName: unit.owner?.brokerName ?? '',
      brokerEmail: unit.owner?.brokerEmail ?? '',
    });
  };

  const createRevenda = async () => {
    if (!detail || !revendaTarget) return;
    setRevendaBusy(true);
    setError('');
    try {
      const response = await fetch('/api/site-vision/revendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvUnidadeId: revendaTarget.id,
          cvEmpreendimentoId: detail.empreendimento.id,
          title: revendaForm.title,
          price: revendaForm.price,
          ownerMode,
          ownerName: revendaForm.ownerName,
          ownerEmail: revendaForm.ownerEmail,
          ownerPhone: revendaForm.ownerPhone,
          ownerDocument: revendaForm.ownerDocument,
          brokerName: revendaForm.brokerName,
          brokerEmail: revendaForm.brokerEmail,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao criar revenda.');
      setRevendaTarget(null);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar revenda.');
    } finally {
      setRevendaBusy(false);
    }
  };

  const toggleUnitVisibility = async (unit: DetailPayload['units'][number]) => {
    setTogglingUnitId(unit.id);
    setError('');
    try {
      const response = await fetch(`/api/site-vision/unidades/${unit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleOnSite: !unit.siteVisible }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Erro ao atualizar unidade.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar unidade.');
    } finally {
      setTogglingUnitId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-white/8 bg-white/[0.03]">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <Loader2 size={16} className="animate-spin" />
          Carregando painel do empreendimento...
        </div>
      </div>
    );
  }

  if (!detail || error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
        {error || 'Não foi possível carregar o empreendimento.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/site-vision/empreendimentos"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]"
        >
          <ArrowLeft size={15} />
          Voltar para empreendimentos
        </Link>
        <div className="text-xs text-zinc-500">
          ID CRM {detail.empreendimento.id} • {detail.siteConfig?.status === 'published' ? 'Publicado no site' : detail.siteConfig?.status === 'archived' ? 'Arquivado' : 'Em rascunho'}
        </div>
      </div>

      <section className="overflow-hidden rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_36%),linear-gradient(180deg,rgba(10,14,15,0.96),rgba(9,9,11,0.98))] shadow-[0_28px_120px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="grid gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="relative min-h-[260px] bg-[#0c0f11]">
            {heroPreview ? (
              <Image src={heroPreview} alt={detail.empreendimento.nome} fill unoptimized className="object-cover opacity-85" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/35 to-transparent" />
          </div>
          <div className="p-6 md:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex rounded-full border border-teal-400/15 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
                  Empreendimento
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">{detail.empreendimento.nome}</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {[detail.empreendimento.tipo, detail.empreendimento.segmento, detail.empreendimento.cidade, detail.empreendimento.bairro].filter(Boolean).join(' • ')}
                </p>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300">
                  {editorialForm.resumo || 'Painel editorial e operacional do empreendimento: conteúdo do site, galeria, vídeo, materiais, unidades e revendas.'}
                </p>
                <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
                  {detail.siteConfig?.enabled ? 'Publicado no site público' : 'Ainda não publicado no site público'}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <button onClick={() => saveConfig({ enabled: !(detail.siteConfig?.enabled ?? false) })} disabled={savingConfig} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${detail.siteConfig?.enabled ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-zinc-400/20 bg-zinc-500/10 text-zinc-200'}`}>
                  {savingConfig ? 'Salvando...' : detail.siteConfig?.enabled ? 'Publicado no site' : 'Publicar no site'}
                </button>
                <button onClick={() => saveConfig({ showOnHome: !(detail.siteConfig?.showOnHome ?? false) })} disabled={savingConfig} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${detail.siteConfig?.showOnHome ? 'border-sky-400/20 bg-sky-500/10 text-sky-300' : 'border-zinc-400/20 bg-zinc-500/10 text-zinc-200'}`}>
                  {detail.siteConfig?.showOnHome ? 'Em destaque na home' : 'Fora da home'}
                </button>
                <button onClick={() => saveConfig({ destaque: !(detail.siteConfig?.destaque ?? false) })} disabled={savingConfig} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${detail.siteConfig?.destaque ? 'border-teal-400/20 bg-teal-500/10 text-teal-300' : 'border-zinc-400/20 bg-zinc-500/10 text-zinc-200'}`}>
                  {detail.siteConfig?.destaque ? 'Destaque' : 'Sem destaque'}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {[
                { label: 'Disponíveis', value: detail.counts.available, Icon: Home },
                { label: 'Reservadas', value: detail.counts.reserved, Icon: ShieldCheck },
                { label: 'Vendidas', value: detail.counts.sold, Icon: Building2 },
                { label: 'Assets carregados', value: detail.mediaAssets.length + detail.gatedAssets.length + detail.internalTables.length + detail.crmMedia.length, Icon: Sparkles },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-500/10 text-teal-300">
                      <Icon size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          ['visao-geral', 'Visão geral'],
          ['conteudo', 'Conteúdo do site'],
          ['galeria', 'Galeria e vídeo'],
          ['materiais', 'Materiais e e-book'],
          ['unidades', 'Unidades'],
          ['revendas', 'Revendas'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as TabKey)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${activeTab === key ? 'border-teal-400/20 bg-teal-500/10 text-teal-300' : 'border-white/10 bg-white/[0.04] text-zinc-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'visao-geral' ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard title="Informações do empreendimento" subtitle="Visão do CRM e do conteúdo público em um só lugar.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">Nome público</p>
                <p className="mt-3 text-zinc-400">{editorialForm.displayName || detail.empreendimento.nome}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">Vídeos e hero</p>
                <p className="mt-3 text-zinc-400">
                  {editorialForm.heroVideoUrl ? 'Vídeo hero definido' : 'Sem vídeo hero'}
                  {editorialForm.detailHeroImageUrl ? ' • Hero de detalhe definida' : ' • Sem hero de detalhe'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">Localização</p>
                <p className="mt-3 text-zinc-400">{editorialForm.locationLabel || editorialForm.addressLine || 'Nao informado'}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">Entrega e andamento</p>
                <p className="mt-3 text-zinc-400">{editorialForm.stageLabel || 'Estágio não informado'}{editorialForm.deliveryLabel ? ` • ${editorialForm.deliveryLabel}` : detail.empreendimento.andamento != null ? ` • ${detail.empreendimento.andamento}%` : ''}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">Tags</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {parseLines(editorialForm.tagsText).length === 0 ? <span className="text-zinc-500">Sem tags editoriais</span> : parseLines(editorialForm.tagsText).map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-200">{item}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">Destaques</p>
                <div className="mt-3 space-y-2 text-zinc-400">
                  {parseLines(editorialForm.highlightsText).length === 0 ? <span className="text-zinc-500">Sem highlights definidos</span> : parseLines(editorialForm.highlightsText).map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-300 md:col-span-2">
                <p className="font-semibold text-white">Acesso e canais</p>
                <p className="mt-3 text-zinc-400">
                  {editorialForm.whatsappNumber ? 'WhatsApp configurado' : 'Sem WhatsApp editorial'}
                  {editorialForm.clientPortalUrl ? ' • Portal do cliente configurado' : ' • Sem portal do cliente'}
                  {editorialForm.technicalAssistUrl ? ' • Assistência técnica configurada' : ' • Sem assistência técnica'}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Ativos públicos" subtitle="Tudo que já está preparado para este empreendimento no Site Vision.">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-zinc-300">Assets vindos do CV CRM</span>
                <span className="text-sm font-semibold text-white">{detail.crmMedia.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-zinc-300">Imagens, vídeos e plantas</span>
                <span className="text-sm font-semibold text-white">{detail.mediaAssets.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-zinc-300">Materiais gated</span>
                <span className="text-sm font-semibold text-white">{detail.gatedAssets.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-zinc-300">Tabelas internas</span>
                <span className="text-sm font-semibold text-white">{detail.internalTables.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-zinc-300">Revendas criadas</span>
                <span className="text-sm font-semibold text-white">{detail.resales.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-zinc-300">Bloco editorial estendido</span>
                <span className="text-sm font-semibold text-white">{editorialForm.displayName && editorialForm.locationLabel && editorialForm.stageLabel ? 'Completo' : 'Incompleto'}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'conteudo' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <SectionCard title="Conteúdo do site" subtitle="Aqui entram os textos e parâmetros editoriais do empreendimento.">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Slug</span>
                  <Input value={editorialForm.slug} onChange={(value) => setEditorialForm((current) => ({ ...current, slug: value }))} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Nome público</span>
                  <Input value={editorialForm.displayName} onChange={(value) => setEditorialForm((current) => ({ ...current, displayName: value }))} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Imagem de destaque</span>
                  <Input value={editorialForm.heroImageUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, heroImageUrl: value }))} placeholder="https://..." />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Descrição curta</span>
                  <Input value={editorialForm.shortDescription} onChange={(value) => setEditorialForm((current) => ({ ...current, shortDescription: value }))} placeholder="Texto de card / home" />
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Headline</span>
                <Input value={editorialForm.headline} onChange={(value) => setEditorialForm((current) => ({ ...current, headline: value }))} />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Localização pública</span>
                  <Input value={editorialForm.locationLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, locationLabel: value }))} placeholder="Campeche • Florianópolis" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Endereço público</span>
                  <Input value={editorialForm.addressLine} onChange={(value) => setEditorialForm((current) => ({ ...current, addressLine: value }))} placeholder="Av. Campeche, 2020" />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Estágio</span>
                  <Input value={editorialForm.stageLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, stageLabel: value }))} placeholder="Em construção" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Entrega</span>
                  <Input value={editorialForm.deliveryLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, deliveryLabel: value }))} placeholder="Dezembro 2027" />
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Resumo</span>
                <Textarea value={editorialForm.resumo} onChange={(value) => setEditorialForm((current) => ({ ...current, resumo: value }))} rows={3} />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Descrição completa</span>
                <Textarea value={editorialForm.descricao} onChange={(value) => setEditorialForm((current) => ({ ...current, descricao: value }))} rows={8} />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Área</span>
                  <Input value={editorialForm.areaLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, areaLabel: value }))} placeholder="51 a 186 m²" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Dormitórios</span>
                  <Input value={editorialForm.bedroomsLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, bedroomsLabel: value }))} placeholder="2 e 3 dorms." />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Suítes</span>
                  <Input value={editorialForm.suitesLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, suitesLabel: value }))} placeholder="1 a 3 suítes" />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Vagas</span>
                  <Input value={editorialForm.parkingLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, parkingLabel: value }))} placeholder="1 a 3 vagas" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Andares</span>
                  <Input value={editorialForm.floorsLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, floorsLabel: value }))} placeholder="7 andares" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Unidades</span>
                  <Input value={editorialForm.unitsLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, unitsLabel: value }))} placeholder="49 unidades" />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Texto do CTA</span>
                  <Input value={editorialForm.ctaLabel} onChange={(value) => setEditorialForm((current) => ({ ...current, ctaLabel: value }))} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Destino do CTA</span>
                  <Input value={editorialForm.ctaTarget} onChange={(value) => setEditorialForm((current) => ({ ...current, ctaTarget: value }))} placeholder="/contato ou https://..." />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Logo</span>
                  <Input value={editorialForm.logoUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, logoUrl: value }))} placeholder="https://..." />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Hero do card</span>
                  <Input value={editorialForm.cardHeroImageUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, cardHeroImageUrl: value }))} placeholder="https://..." />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Hero de detalhe</span>
                  <Input value={editorialForm.detailHeroImageUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, detailHeroImageUrl: value }))} placeholder="https://..." />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Vídeo do card</span>
                  <Input value={editorialForm.cardVideoUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, cardVideoUrl: value }))} placeholder="Link curto / embed" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Vídeo hero / tour</span>
                  <Input value={editorialForm.heroVideoUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, heroVideoUrl: value }))} placeholder="YouTube, Vimeo, tour virtual..." />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">WhatsApp</span>
                  <Input value={editorialForm.whatsappNumber} onChange={(value) => setEditorialForm((current) => ({ ...current, whatsappNumber: value }))} placeholder="5548999999999" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Portal do cliente</span>
                  <Input value={editorialForm.clientPortalUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, clientPortalUrl: value }))} placeholder="https://..." />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Assistência técnica</span>
                  <Input value={editorialForm.technicalAssistUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, technicalAssistUrl: value }))} placeholder="https://..." />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Tags do site</span>
                  <Textarea value={editorialForm.tagsText} onChange={(value) => setEditorialForm((current) => ({ ...current, tagsText: value }))} rows={6} placeholder="Uma por linha" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Highlights</span>
                  <Textarea value={editorialForm.highlightsText} onChange={(value) => setEditorialForm((current) => ({ ...current, highlightsText: value }))} rows={6} placeholder="Um destaque por linha" />
                </label>
              </div>
              <div className="flex justify-end">
                <button onClick={() => saveConfig()} disabled={savingConfig} className="rounded-2xl border border-teal-400/20 bg-teal-500/10 px-5 py-3 text-sm font-semibold text-teal-300">
                  {savingConfig ? 'Salvando conteúdo...' : 'Salvar conteúdo'}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Preview textual" subtitle="Como o bloco principal tende a ser percebido no site.">
            <div className="space-y-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
              {editorialForm.logoUrl ? (
                <div className="relative h-12 w-40">
                  <Image src={editorialForm.logoUrl} alt={editorialForm.displayName || detail.empreendimento.nome} fill unoptimized className="object-contain object-left" />
                </div>
              ) : null}
              <div className="inline-flex rounded-full border border-teal-400/15 bg-teal-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
                {editorialForm.stageLabel || detail.empreendimento.segmento || detail.empreendimento.tipo || 'Empreendimento'}
              </div>
              <h3 className="text-3xl font-semibold tracking-tight text-white">{editorialForm.displayName || detail.empreendimento.nome}</h3>
              <p className="text-sm text-zinc-400">{editorialForm.locationLabel || 'Defina a localização pública do empreendimento.'}</p>
              <p className="text-sm leading-relaxed text-zinc-300">{editorialForm.shortDescription || editorialForm.resumo || 'Adicione um resumo comercial forte para o site.'}</p>
              <div className="flex flex-wrap gap-2">
                {parseLines(editorialForm.highlightsText).map((item) => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-200">
                    <Star size={12} />
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                {[editorialForm.areaLabel, editorialForm.bedroomsLabel, editorialForm.suitesLabel, editorialForm.parkingLabel, editorialForm.unitsLabel].filter(Boolean).map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{item}</span>
                ))}
              </div>
              <button className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white">
                {editorialForm.ctaLabel || 'Quero saber mais'}
              </button>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'galeria' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Galeria e vídeo" subtitle="Controle editorial das imagens, capa, ordem da galeria e vídeo do empreendimento.">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Tipo</span>
                  <select value={mediaForm.kind} onChange={(event) => setMediaForm((current) => ({ ...current, kind: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none">
                    <option value="image">Imagem</option>
                    <option value="video">Vídeo</option>
                    <option value="floorplan">Planta</option>
                    <option value="document">Documento</option>
                    <option value="logo">Logo</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Título</span>
                  <Input value={mediaForm.title} onChange={(value) => setMediaForm((current) => ({ ...current, title: value }))} />
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">URL pública</span>
                <Input value={mediaForm.publicUrl} onChange={(value) => setMediaForm((current) => ({ ...current, publicUrl: value }))} placeholder="https://..." />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Thumbnail</span>
                  <Input value={mediaForm.thumbnailUrl} onChange={(value) => setMediaForm((current) => ({ ...current, thumbnailUrl: value }))} placeholder="https://..." />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Alt text</span>
                  <Input value={mediaForm.altText} onChange={(value) => setMediaForm((current) => ({ ...current, altText: value }))} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">URL do vídeo principal</span>
                  <Input value={editorialForm.videoUrl} onChange={(value) => setEditorialForm((current) => ({ ...current, videoUrl: value }))} placeholder="YouTube, Vimeo, tour virtual..." />
                </label>
                <div className="flex items-end">
                  <button onClick={() => saveConfig({ videoUrl: editorialForm.videoUrl })} disabled={savingConfig} className="h-11 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 text-sm font-semibold text-sky-300">
                    Salvar vídeo
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={!!mediaBusy}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-100"
                  >
                    {mediaBusy === 'uploading' ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Enviar imagem para o banco
                  </button>
                  <button onClick={addMedia} disabled={!!mediaBusy} className="inline-flex items-center gap-2 rounded-2xl border border-teal-400/20 bg-teal-500/10 px-5 py-3 text-sm font-semibold text-teal-300">
                    {mediaBusy === 'creating' ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                    Adicionar por URL
                  </button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadMediaFile(file);
                    }}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Assets do empreendimento" subtitle="Primeiro o que veio do CV CRM, depois os assets editoriais escolhidos para o site.">
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-sm font-semibold text-white">Mídias vindas do CV CRM</p>
                {detail.crmMedia.length === 0 ? (
                  <EmptyState text="O espelho atual do CV CRM não trouxe foto, logo ou outras mídias visíveis para este empreendimento." />
                ) : (
                  <div className="space-y-3">
                    {detail.crmMedia.map((asset) => (
                      <div key={asset.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="relative h-16 w-24 overflow-hidden rounded-2xl bg-black/30">
                              <Image src={asset.thumbnailUrl || asset.publicUrl} alt={asset.title} fill unoptimized className="object-cover" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-white">{asset.title}</p>
                                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-300">{asset.kind}</span>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">CV CRM</span>
                              </div>
                              <p className="mt-1 truncate text-xs text-zinc-500">{asset.publicUrl}</p>
                            </div>
                          </div>
                          <a href={asset.publicUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200">
                            Abrir mídia
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-white">Assets editoriais do site</p>
                <p className="mb-3 text-xs text-zinc-500">Arraste para ordenar a galeria. Definir capa escolhe a imagem principal do site.</p>
                {detail.mediaAssets.length === 0 ? (
                  <EmptyState text="Nenhum asset editorial cadastrado ainda. Você pode usar só as mídias do CV CRM ou adicionar uma galeria própria para o site." />
                ) : (
                  detail.mediaAssets.map((asset) => (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={() => setDraggingMediaId(asset.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (!draggingMediaId || draggingMediaId === asset.id || !detail) return;
                        const orderedIds = [...detail.mediaAssets]
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((item) => item.id);
                        const fromIndex = orderedIds.indexOf(draggingMediaId);
                        const toIndex = orderedIds.indexOf(asset.id);
                        if (fromIndex < 0 || toIndex < 0) return;
                        const nextIds = [...orderedIds];
                        const [moved] = nextIds.splice(fromIndex, 1);
                        nextIds.splice(toIndex, 0, moved);
                        void reorderMedia(nextIds);
                      }}
                      onDragEnd={() => setDraggingMediaId(null)}
                      className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 ${draggingMediaId === asset.id ? 'opacity-60' : ''}`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="relative h-16 w-24 overflow-hidden rounded-2xl bg-black/30">
                            {asset.thumbnailUrl || asset.publicUrl ? (
                              <Image src={asset.thumbnailUrl || asset.publicUrl} alt={asset.title || detail.empreendimento.nome} fill unoptimized className="object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">{asset.title || 'Asset sem título'}</p>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">{asset.kind}</span>
                              {asset.isPrimary ? <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200">Capa</span> : null}
                              {asset.origin === 'upload' ? <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-300">Banco</span> : null}
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">{asset.publicUrl}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => updateMedia(asset.id, 'primary')} disabled={!!mediaBusy} className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">Definir capa</button>
                          <button onClick={() => updateMedia(asset.id, 'delete')} disabled={!!mediaBusy} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">Excluir</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'materiais' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Materiais do CRM e internos" subtitle="Arquivos que já existem para consulta e download operacional.">
            <div className="space-y-3">
              {detail.materials.length === 0 ? (
                <EmptyState text={detail.empreendimento.linkDisponibilidade ? 'Ainda não há materiais espelhados no nosso banco para este empreendimento. O CV CRM mostra arquivos no mapa de disponibilidade, mas eles ainda precisam entrar no espelho local para aparecer aqui.' : 'Nenhum material foi encontrado no espelho do CV CRM nem hospedado manualmente para este empreendimento.'} />
              ) : (
                detail.materials.map((material) => (
                  <a key={material.id} href={material.downloadUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 transition-colors hover:bg-white/[0.05]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{material.nome}</p>
                      <p className="mt-1 text-xs text-zinc-500">{material.tipo} • {material.fonte === 'cvcrm' ? 'CV CRM' : 'Manual'} • {bytes(material.sizeBytes)}</p>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-teal-300">
                      <Download size={15} />
                      Baixar
                    </div>
                  </a>
                ))
              )}

              <div className="pt-2">
                <p className="mb-3 text-sm font-semibold text-white">Tabelas internas</p>
                {detail.internalTables.length === 0 ? (
                  <EmptyState text="Nenhuma tabela interna foi hospedada para este empreendimento ainda. Tabelas ficam só no Site Vision, não no site público." />
                ) : (
                  <div className="space-y-3">
                    {detail.internalTables.map((table) => (
                      <a key={table.id} href={table.publicUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 transition-colors hover:bg-white/[0.05]">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{table.title}</p>
                          <p className="mt-1 text-xs text-zinc-500">{table.versionLabel || 'Sem versão'} • {bytes(table.sizeBytes)} • {formatDate(table.createdAt)}</p>
                        </div>
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-teal-300">
                          <Download size={15} />
                          Abrir tabela
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="E-book e materiais gated" subtitle="Materiais liberados só após formulário no site.">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Título</span>
                  <Input value={gatedForm.title} onChange={(value) => setGatedForm((current) => ({ ...current, title: value }))} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Tipo</span>
                  <select value={gatedForm.type} onChange={(event) => setGatedForm((current) => ({ ...current, type: event.target.value as 'ebook' | 'brochure' | 'document' }))} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none">
                    <option value="ebook">E-book</option>
                    <option value="brochure">Brochure</option>
                    <option value="document">Documento</option>
                  </select>
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">URL pública do arquivo</span>
                <Input value={gatedForm.publicUrl} onChange={(value) => setGatedForm((current) => ({ ...current, publicUrl: value }))} placeholder="https://..." />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Thumbnail</span>
                  <Input value={gatedForm.thumbnailUrl} onChange={(value) => setGatedForm((current) => ({ ...current, thumbnailUrl: value }))} placeholder="https://..." />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Tag do lead</span>
                  <Input value={gatedForm.leadTag} onChange={(value) => setGatedForm((current) => ({ ...current, leadTag: value }))} placeholder="ebook-nautic" />
                </label>
              </div>
              <div className="flex justify-end">
                <button onClick={addGatedAsset} disabled={gatedBusy} className="inline-flex items-center gap-2 rounded-2xl border border-teal-400/20 bg-teal-500/10 px-5 py-3 text-sm font-semibold text-teal-300">
                  {gatedBusy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                  Cadastrar material gated
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {detail.gatedAssets.length === 0 ? (
                  <EmptyState text="Nenhum e-book ou material gated cadastrado ainda." />
                ) : (
                  detail.gatedAssets.map((asset) => (
                    <div key={asset.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{asset.title}</p>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">{asset.type}</span>
                            <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${asset.active ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-zinc-400/20 bg-zinc-500/10 text-zinc-300'}`}>{asset.active ? 'Ativo' : 'Inativo'}</span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">{asset.publicUrl}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => toggleGatedAsset(asset.id, !asset.active)} disabled={gatedBusy} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${asset.active ? 'border-zinc-400/20 bg-zinc-500/10 text-zinc-200' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'}`}>
                            {asset.active ? 'Desligar' : 'Ligar'}
                          </button>
                          <a href={asset.publicUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200">
                            Abrir
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === 'unidades' ? (
        <div className="grid gap-6">
          <SectionCard title="Unidades do empreendimento" subtitle="Disponíveis, reservadas e vendidas com os detalhes operacionais mais relevantes. Revendas ficam em uma aba separada.">
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                ['all', 'Todas'],
                ['available', 'Disponíveis'],
                ['reserved', 'Reservadas'],
                ['sold', 'Vendidas'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as 'all' | 'available' | 'reserved' | 'sold')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === key ? 'border-teal-400/20 bg-teal-500/10 text-teal-300' : 'border-white/10 bg-white/[0.04] text-zinc-400'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredUnits.map((unit) => {
                const areaPrivativa = formatArea(unit.raw.area_privativa ?? unit.raw.areaprivativa ?? unit.raw.metragem_privativa ?? unit.metragem);
                const areaTotal = formatArea(unit.raw.area_total ?? unit.raw.areatotal);
                const vagas = pickRawValue(unit.raw, ['vagas', 'vaga_garagem', 'numero_vagas']);
                const finalCol = pickRawValue(unit.raw, ['final', 'face', 'posicao']);
                const unitPrice = resolveUnitPrice(unit);
                return (
                  <div key={unit.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            {[unit.bloco ? `Bloco ${unit.bloco}` : null, unit.numero ? `Unidade ${unit.numero}` : `Unidade ${unit.id}`].filter(Boolean).join(' • ')}
                          </p>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusTone(unit.status)}`}>{unit.status || 'Sem status'}</span>
                          {unit.resale ? <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300">Revenda criada</span> : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {[unit.tipologia, unit.andar ? `${unit.andar}º andar` : '', unit.coluna ? `Coluna ${unit.coluna}` : '', areaPrivativa ? `${areaPrivativa} m² priv.` : '', areaTotal ? `${areaTotal} m² total` : '', vagas ? `${vagas} vaga(s)` : '', finalCol || '']
                            .filter(Boolean)
                            .map((item) => (
                              <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">{item}</span>
                            ))}
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Valor base</p>
                            <p className="mt-2 font-semibold text-white">{money(unitPrice)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Site</p>
                            <p className="mt-2 font-semibold text-white">{unit.siteVisible ? 'Visível' : 'Oculta'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Status venda</p>
                            <p className="mt-2 font-semibold text-white">{unit.status || unit.statusVenda || '—'}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Data da venda</p>
                            <p className="mt-2 font-semibold text-white">{formatDate(unit.owner?.soldAt ?? null)}</p>
                          </div>
                        </div>

                        {unit.owner ? (
                          <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                            <p className="font-semibold text-white">Proprietário / comprador</p>
                            <p className="mt-1">{unit.owner.name || 'Sem nome'}{unit.owner.phone ? ` • ${unit.owner.phone}` : ''}</p>
                            <p className="text-xs text-zinc-500">{unit.owner.email || 'Sem e-mail'}{unit.owner.document ? ` • ${unit.owner.document}` : ''}</p>
                            <p className="mt-1 text-xs text-zinc-500">Corretor: {unit.owner.brokerName || 'Não identificado'}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {!isSoldUnit(unit) ? (
                          <button
                            onClick={() => toggleUnitVisibility(unit)}
                            disabled={togglingUnitId === unit.id}
                            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${unit.siteVisible ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15' : 'border-zinc-400/20 bg-zinc-500/10 text-zinc-200 hover:bg-zinc-500/15'}`}
                          >
                            {togglingUnitId === unit.id ? <Loader2 size={15} className="animate-spin" /> : unit.siteVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                            {unit.siteVisible ? 'Ligada no site' : 'Desligada do site'}
                          </button>
                        ) : null}
                        {isSoldUnit(unit) && !unit.resale ? (
                          <button onClick={() => openRevenda(unit)} className="inline-flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/15">
                            <MapPinned size={15} />
                            Disponibilizar para revenda
                          </button>
                        ) : null}
                        {unit.resale ? (
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-300">
                            {unit.resale.titulo_publico || 'Revenda cadastrada'}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

        </div>
      ) : null}

      {activeTab === 'revendas' ? (
        <div className="grid gap-6">
          <SectionCard title="Operação de revendas" subtitle="Revendas são tratadas separadamente das unidades da construtora. Aqui você cria e acompanha a oferta secundária.">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Vendidas elegíveis</p>
                <p className="mt-2 text-2xl font-semibold text-white">{resaleCandidates.length}</p>
                <p className="mt-2 text-xs text-zinc-500">Unidades vendidas que ainda podem virar revenda.</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Revendas criadas</p>
                <p className="mt-2 text-2xl font-semibold text-white">{detail.resales.length}</p>
                <p className="mt-2 text-xs text-zinc-500">Ofertas secundárias já abertas dentro do Site Vision.</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Publicação</p>
                <p className="mt-2 text-2xl font-semibold text-white">{detail.siteConfig?.enabled ? 'Site on' : 'Rascunho'}</p>
                <p className="mt-2 text-xs text-zinc-500">Publicar o empreendimento não publica revendas automaticamente.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Unidades prontas para virar revenda" subtitle="Você pode criar uma revenda mesmo quando o CRM não trouxe todos os dados do proprietário.">
            {resaleCandidates.length === 0 ? (
              <EmptyState text="Nenhuma unidade vendida está aguardando criação de revenda neste empreendimento." />
            ) : (
              <div className="space-y-3">
                {resaleCandidates.slice(0, 20).map((unit) => (
                  <div key={unit.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {[unit.bloco ? `Bloco ${unit.bloco}` : null, unit.numero ? `Unidade ${unit.numero}` : `Unidade ${unit.id}`].filter(Boolean).join(' • ')}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {unit.owner?.name || 'Proprietário não sincronizado'} • valor base {money(resolveUnitPrice(unit))}
                        </p>
                      </div>
                      <button onClick={() => openRevenda(unit)} className="inline-flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/15">
                        <MapPinned size={15} />
                        Disponibilizar para revenda
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Revendas já criadas" subtitle="Unidades vendidas reaproveitadas com nova oferta pública.">
            {detail.resales.length === 0 ? (
              <EmptyState text="Nenhuma revenda foi criada para este empreendimento ainda." />
            ) : (
              <div className="space-y-3">
                {detail.resales.map((resale) => (
                  <div key={resale.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{resale.titulo_publico || `Revenda ${resale.cv_unidade_id}`}</p>
                          <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-300">{resale.status_publicacao}</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          Unidade {resale.cv_unidade_id} • {resale.corretor_nome || 'Sem corretor'} • {resale.owner_name || 'Sem proprietário'}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-white">{money(resale.preco_revenda)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {revendaTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/8 bg-[#0f1113] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">Transformar unidade em revenda</p>
                <p className="mt-1 text-sm text-zinc-400">Escolha se mantemos os dados do proprietário atual ou se você quer atualizá-los.</p>
              </div>
              <button onClick={() => setRevendaTarget(null)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">Fechar</button>
            </div>

            <div className="mt-5 flex gap-2">
              {[
                ['keep', 'Manter proprietário'],
                ['update', 'Atualizar proprietário'],
              ].map(([key, label]) => (
                <button key={key} onClick={() => setOwnerMode(key as 'keep' | 'update')} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${ownerMode === key ? 'border-teal-400/20 bg-teal-500/10 text-teal-300' : 'border-white/10 bg-white/[0.04] text-zinc-400'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ['Título da revenda', 'title'],
                ['Novo valor', 'price'],
                ['Nome do proprietário', 'ownerName'],
                ['E-mail do proprietário', 'ownerEmail'],
                ['Telefone do proprietário', 'ownerPhone'],
                ['Documento do proprietário', 'ownerDocument'],
                ['Corretor responsável', 'brokerName'],
                ['E-mail do corretor', 'brokerEmail'],
              ].map(([label, key]) => (
                <label key={key} className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</span>
                  <input
                    value={revendaForm[key as keyof typeof revendaForm]}
                    onChange={(event) => setRevendaForm((current) => ({ ...current, [key]: event.target.value }))}
                    disabled={ownerMode === 'keep' && key.startsWith('owner') && key !== 'price' && key !== 'title' && key !== 'brokerName' && key !== 'brokerEmail'}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-100 outline-none"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="text-xs text-zinc-500">
                Unidade {revendaTarget.numero || revendaTarget.id} • valor original {money(resolveUnitPrice(revendaTarget))}
              </div>
              <button onClick={createRevenda} disabled={revendaBusy} className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/15">
                {revendaBusy ? <Loader2 size={15} className="animate-spin" /> : <MapPinned size={15} />}
                Criar revenda
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
