import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Carrega .env.local
const envPath = path.join(process.cwd(), '.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
  console.error('Falha ao ler .env.local:', e);
}

const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
});

const dbUrl = env.DATABASE_URL;
const metaToken = env.META_TOKEN;
const actId = env.META_ACT_ID;

console.log('DATABASE_URL:', dbUrl ? 'Configurada' : 'Não configurada');
console.log('META_TOKEN length:', metaToken ? metaToken.length : 0);
console.log('META_ACT_ID:', actId);

async function run() {
  // 1. Diagnóstico do Banco
  if (dbUrl) {
    try {
      const sql = postgres(dbUrl, { max: 1 });
      console.log('\n--- DIAGNÓSTICO DO BANCO ---');
      
      // Contagem por origem
      const resOrigem = await sql`SELECT origem, count(*) FROM leads GROUP BY origem ORDER BY count DESC`;
      console.log('Quantidade de leads por origem:');
      console.table(resOrigem);

      // Leads do Meta
      const resMeta = await sql`SELECT id, nome, email, telefone, origem, empreendimento, data_cadastro, synced_at FROM leads WHERE origem ILIKE '%meta%' ORDER BY data_cadastro DESC LIMIT 10`;
      console.log('Últimos 10 leads do Meta no banco:');
      console.table(resMeta);
      
      // Vamos ver o campo raw do lead mais recente
      const rawRes = await sql`SELECT id, raw FROM leads ORDER BY data_cadastro DESC LIMIT 1`;
      if (rawRes.length > 0) {
        console.log('Raw data do lead mais recente:');
        console.log(JSON.stringify(rawRes[0].raw, null, 2));
      }

      await sql.end();
    } catch (e) {
      console.error('Erro no Banco de Dados:', e);
    }
  }

  // 2. Diagnóstico da API do Meta
  if (metaToken) {
    console.log('\n--- DIAGNÓSTICO DO META API ---');
    try {
      // Testando chamada do token
      const debugRes = await axios.get(`https://graph.facebook.com/v21.0/debug_token`, {
        params: {
          input_token: metaToken,
          access_token: metaToken
        }
      });
      console.log('Informações do token (debug_token):');
      console.log(JSON.stringify(debugRes.data, null, 2));
    } catch (err: any) {
      console.warn('debug_token falhou:', err.response?.data || err.message);
      // Tentamos o /me
      try {
        const meRes = await axios.get(`https://graph.facebook.com/v21.0/me`, {
          params: { access_token: metaToken }
        });
        console.log('/me response:', meRes.data);
      } catch (errMe: any) {
        console.error('/me falhou também:', errMe.response?.data || errMe.message);
      }
    }

    // Tenta obter informações da Página 259079394232614
    try {
      const pageId = '259079394232614';
      const pageRes = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
        params: {
          fields: 'id,name,category,tasks',
          access_token: metaToken
        }
      });
      console.log('Informações da Página consultada:');
      console.log(JSON.stringify(pageRes.data, null, 2));
    } catch (errPage: any) {
      console.error('Busca de informações da página falhou:', errPage.response?.data || errPage.message);
    }
  }
}

run();
