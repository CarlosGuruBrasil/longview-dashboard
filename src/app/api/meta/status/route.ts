/**
 * /api/meta/status
 *
 * Retorna dados consolidados para o painel de monitoramento da automação.
 * Lê os logs do KV gravados pelos cron jobs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { kv } from '@vercel/kv';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const ACT_ID    = process.env.META_ACT_ID;

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
      kv.get('meta:sync:last'),
      kv.get('meta:sync:lastRun'),
      kv.get('meta:leads:lastRun'),
      kv.get('meta:leads:lastStats'),
      kv.get('meta:scores:lastRun'),
      kv.get('meta:scores:lastStats'),
      kv.get('meta:capi:log'),
      kv.get('meta:capi:last'),
      kv.get('cv:webhook:log'),
      kv.get('cv:webhook:last'),
      kv.get('cv:webhook:sem_conexao_count'),
    ]);

    const get = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;

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
    let audiences: any[] = [];
    try {
      const res = await axios.get(`${META_BASE}/${ACT_ID}/customaudiences`, {
        params: {
          fields: 'id,name,approximate_count_lower_bound,approximate_count_upper_bound,subtype,operation_status,time_updated',
          limit: 50,
          ...metaAuth(),
        },
        timeout: 10000,
      });
      audiences = (res.data?.data || [])
        .filter((a: any) => a.name.startsWith('LV |'))
        .map((a: any) => ({
          id:          a.id,
          name:        a.name,
          subtype:     a.subtype,
          status:      a.operation_status?.code === 200 ? 'Pronta' : (a.operation_status?.description || 'Processando'),
          count_min:   a.approximate_count_lower_bound,
          count_max:   a.approximate_count_upper_bound,
          updated:     a.time_updated ? new Date(a.time_updated * 1000).toISOString() : null,
        }));
    } catch { /* retorna vazio */ }

    const syncData    = get(syncLast) as any;
    const leadsStats  = get(leadsLastStats) as any;
    const scoresStats = get(scoresLastStats) as any;
    const capiEvents  = (get(capiLog) as any[]) || [];

    const today = new Date().toISOString().split('T')[0];
    const capiToday = capiEvents.filter((e: any) => e.ts?.startsWith(today)).length;

    const cvLog    = (get(cvWebhookLog) as any[]) || [];
    const cvToday  = cvLog.filter((e: any) => e.ts?.startsWith(today) && e.triggered).length;

    return NextResponse.json({
      semConexao: {
        webhookUrl:    'https://longview-dashboard.vercel.app/api/cv/webhook',
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
