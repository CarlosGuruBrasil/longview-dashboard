/**
 * Teste manual do payload CAPI corrigido (Conversion Leads) contra a API
 * real da Meta — usa test_event_code (META_TEST_EVENT_CODE em .env.local)
 * para não poluir estatísticas reais do pixel.
 *
 * Rodar da raiz do projeto:
 *   node scripts/test-capi.mjs
 *
 * O sandbox do Claude não tem rota de rede até graph.facebook.com, então
 * este teste precisa ser rodado na sua máquina (que tem internet normal).
 *
 * O que verificar na resposta:
 *   - HTTP 200 e "events_received": 1 → payload aceito pela API
 *   - Depois, no Gerenciador de Eventos → Testar eventos (com o mesmo
 *     código de teste), o evento "Visita agendada" deve aparecer com
 *     status "Recebido" nas próximas ~1-2 min.
 */
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

function loadEnv(path) {
  const txt = readFileSync(path, 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

const env = loadEnv(new URL('../.env.local', import.meta.url));
const PIXEL_ID  = env.META_PIXEL_ID;
const TOKEN     = env.META_TOKEN;
const TEST_CODE = env.META_TEST_EVENT_CODE;

if (!PIXEL_ID || !TOKEN) {
  console.error('Faltando META_PIXEL_ID ou META_TOKEN em .env.local');
  process.exit(1);
}
if (!TEST_CODE) {
  console.warn('META_TEST_EVENT_CODE não definido — o evento será enviado como EVENTO REAL, não como teste.');
}

function hash(v) {
  return createHash('sha256').update(v.toLowerCase().trim()).digest('hex');
}

const now = Math.floor(Date.now() / 1000);

// Mesma forma exata que src/app/api/meta/capi/route.ts agora produz.
const testEvent = {
  event_name:    'Visita agendada',
  event_time:    now,
  event_id:      `test_${now}`,
  action_source: 'system_generated',
  user_data: {
    lead_id: '1234567890123456', // simulado — formato real de leadgen_id (15-17 dígitos)
    em:      hash('teste@longview.com.br'),
    ph:      hash('+5548999999999'),
  },
  custom_data: {
    event_source:      'crm',
    lead_event_source: 'CV CRM',
  },
};

const body = {
  data: [testEvent],
  access_token: TOKEN,
  ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
};

const res  = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify(body),
});
const json = await res.json();

console.log('HTTP status:', res.status);
console.log('Resposta da Meta:', JSON.stringify(json, null, 2));
console.log('\nusou test_event_code:', !!TEST_CODE);
console.log('PIXEL_ID usado:', PIXEL_ID);
