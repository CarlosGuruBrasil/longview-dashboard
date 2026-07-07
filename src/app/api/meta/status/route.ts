/**
 * /api/meta/status
 *
 * Retorna dados consolidados para o painel de monitoramento da automação.
 * Lê os logs do KV gravados pelos cron jobs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { kv } from '@/lib/kv';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const ACT_ID    = process.env.META_ACT_ID;

type SyncData = {
  ok?: boolean;
  totalContacts?: { buyers?: number; all?: number };
  audiences?: unknown[];
};

type LeadStats = {
  ok?: boolean;
  newLeads?: number;
  sentToRD?: number;
  capiSent?: number;
};

type ScoreStats = {
  ok?: boolean;
  total?: number;
  quentes?: number;
  mornos?: number;
  frios?: number;
  sentToRD?: number;
  capiSent?: number;
};

type TimedLog = {
  ts?: string;
  triggered?: boolean;
  [key: string]: unknown;
};

type MetaAudienceRaw = {
  id?: string;
  name?: string;
  subtype?: string;
  operation_status?: { code?: number; description?: string };
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  time_updated?: number;
};

type MetaAudiencesResponse = { data?: MetaAudienceRaw[] };

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    // Lê todos os dados do KV em paralelo
    const [
      syncLast,
      syncLastRun,
      leadsLastRun,
      leadsLastStats,
      scoresLastRun,
      scoresLastStats,
      capiLog,
      capiLast,
      cvWebhookLog,
      cvWebhookLast,
      cvSemConexaoCount,
    ] = await Promise.allSettled([
      kv.get<SyncData>('meta:sync:last'),
      kv.get<string>('meta:sync:lastRun'),
      kv.get<string>('meta:leads:lastRun'),
      kv.get<LeadStats>('meta:leads:lastStats'),
      kv.get<string>('meta:scores:lastRun'),
      kv.get<ScoreStats>('meta:scores:lastStats'),
      kv.get<TimedLog[]>('meta:capi:log'),
      kv.get<string>('meta:capi:last'),
      kv.get<TimedLog[]>('cv:webhook:log'),
      kv.get<string>('cv:webhook:last'),
      kv.get<number>('cv:webhook:sem_conexao_count'),
    ]);

    const get = <T>(r: PromiseSettledResult<T>) => r.status === 'fulfilled' ? r.value : null;

    // Próximas execuções baseadas na última + intervalo
    function nextRun(lastRun: string | null, intervalHours: number): string {
      if (!lastRun) return 'Aguardando primeira execução';
      const last = new Date(lastRun);
      const next = new Date(last.getTime() + intervalHours * 3600000);
      const diff = next.getTime() - Date.now();
      if (diff <= 0) return 'Em breve';
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return h > 0 ? `em ${h}h ${m}min` : `em ${m}min`;
    }

    // Audiências no Meta (consulta live se possível)
    let audiences: unknown[] = [];
    try {
      const res = await axios.get<MetaAudiencesResponse>(`${META_BASE}/${ACT_ID}/customaudiences`, {
        params: {
          fields: 'id,name,approximate_count_lower_bound,approximate_count_upper_bound,subtype,operation_status,time_updated',
          limit: 50,
          ...metaAuth(),
        },
        timeout: 10000,
      });
      audiences = (res.data?.data || [])
        .filter((a) => a.name?.startsWith('LV |'))
        .map((a) => ({
          id:          a.id,
          name:        a.name,
          subtype:     a.subtype,
          status:      a.operation_status?.code === 200 ? 'Pronta' : (a.operation_status?.description || 'Processando'),
          count_min:   a.approximate_count_lower_bound,
          count_max:   a.approximate_count_upper_bound,
          updated:     a.time_updated ? new Date(a.time_updated * 1000).toISOString() : null,
        }));
    } catch { /* retorna vazio */ }

    const syncData    = get(syncLast);
    const leadsStats  = get(leadsLastStats);
    const scoresStats = get(scoresLastStats);
    const capiEvents  = get(capiLog) || [];

    const today = new Date().toISOString().split('T')[0];
    const capiToday = capiEvents.filter((e) => e.ts?.startsWith(today)).length;

    const cvLog    = get(cvWebhookLog) || [];
    const cvToday  = cvLog.filter((e) => e.ts?.startsWith(today) && e.triggered).length;

    return NextResponse.json({
      semConexao: {
        webhookUrl:    `${request.nextUrl.origin || 'https://app.guru.dev.br'}/api/webhooks/cvcrm`,
        lastReceived:  get(cvWebhookLast),
        totalDisparos: get(cvSemConexaoCount) || 0,
        todayCount:    cvToday,
        recentEvents:  cvLog.slice(0, 20),
      },
      sync: {
        lastRun:     get(syncLastRun),
        nextRun:     nextRun(get(syncLastRun) as string, 24 * 7), // semanal
        ok:          syncData?.ok ?? null,
        totalBuyers: syncData?.totalContacts?.buyers ?? null,
        totalBase:   syncData?.totalContacts?.all    ?? null,
        audiences:   syncData?.audiences             ?? [],
      },
      leads: {
        lastRun:    get(leadsLastRun),
        nextRun:    nextRun(get(leadsLastRun) as string, 2),
        ok:         leadsStats?.ok   ?? null,
        newLeads:   leadsStats?.newLeads  ?? 0,
        sentToRD:   leadsStats?.sentToRD  ?? 0,
        capiSent:   leadsStats?.capiSent  ?? 0,
      },
      scores: {
        lastRun:   get(scoresLastRun),
        nextRun:   nextRun(get(scoresLastRun) as string, 24),
        ok:        scoresStats?.ok       ?? null,
        total:     scoresStats?.total    ?? 0,
        quentes:   scoresStats?.quentes  ?? 0,
        mornos:    scoresStats?.mornos   ?? 0,
        frios:     scoresStats?.frios    ?? 0,
        sentToRD:  scoresStats?.sentToRD ?? 0,
        capiSent:  scoresStats?.capiSent ?? 0,
      },
      capi: {
        last:        get(capiLast),
        todayCount:  capiToday,
        recentEvents: capiEvents.slice(0, 20),
      },
      audiences,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
