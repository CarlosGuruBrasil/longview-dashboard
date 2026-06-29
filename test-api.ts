import { getInspections, getVerifications, MODEL_TYPES } from './src/lib/construpoint';

async function test() {
  console.log('Testing the raw HTTP responses from Construpoint API and checking for XML/HTML error payloads or missing custom parameters...');
  
  // Vamos obter o token dinamicamente
  const basicAuth = process.env.CONSTRUPOINT_BASIC_AUTH
    ?? 'YTMyYjVlMmVkZGRhNGJmN2I2YmY4ZjE0ZDFhY2QxOWE6TG9uZ3ZpZXdATG9uZ3ZpZXc=';
  const username  = process.env.CONSTRUPOINT_USERNAME ?? 'adminapi_longview@e-construmarket.com.br';
  const password  = process.env.CONSTRUPOINT_PASSWORD ?? '*GSuG8U8';

  const body = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
  });

  const tokenRes = await fetch('https://Authenticate.construpoint.com.br/api/Token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  console.log('Obtained token successfully.');

  // Sienge/Construpoint REST APIs usam DTO PascalCase.
  // Vamos verificar as claims do JWT para obter informações extras
  const parts = token.split('.');
  let tenantId = '';
  if (parts.length === 3) {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    console.log('Token Customer ID / Client ID claim:', payload.customer_id || payload.client_id || payload.sub);
  }

  const modelReportEndpoint = `InspecoesPorModeloCustom${String.fromCharCode(81, 117, 97, 108, 105, 100, 97, 100, 101)}`;

  // Vamos tentar chamar o relatório customizado por modelo enviando os parâmetros exigidos no PDF:
  // BeginDate, EndDate, ModelTypeId, StatusVerificacoesId, HistoricoCompleto, CamposPersonalizados, WorkId, ReviewId.
  // Como e-Construmarket / Construpoint às vezes exige um cabeçalho customizado (como 'X-Tenant', 'X-Customer-Id' ou 'client_id'),
  // vamos tentar adicionar o client_id ou customer_id no body, ou ver se tem a ver com o ModelTypeId que pode não ter dados em 2025.
  // Vamos buscar no ano de 2025 e 2026, com uma data bem curta, sem nenhum cabeçalho extra além de Bearer token.
  
  console.log('1. Calling getInspections for FVS (1) in a short range of 2025...');
  const res1 = await fetch(`https://app.construpoint.com.br/Construpoint.API/api/RelatorioCKL/${modelReportEndpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      BeginDate: '2025-05-01',
      EndDate: '2025-05-10',
      ModelTypeId: 1,
      StatusVerificacoesId: null,
      HistoricoCompleto: false,
      CamposPersonalizados: false,
      WorkId: [],
      ReviewId: null
    })
  });
  console.log('Response status:', res1.status);
  console.log('Response body:', await res1.text());
}

test();
