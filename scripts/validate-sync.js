#!/usr/bin/env node

const { sql } = require('../src/lib/pg');

async function validateSync() {
  console.log('🔍 Validando sincronização Site Vision...\n');

  try {
    // 1. Verificar empreendimentos no CRM
    const crmEmps = await sql`
      SELECT id, nome, situacao 
      FROM cv_empreendimentos 
      ORDER BY id DESC 
      LIMIT 10
    `;
    
    console.log(`✅ Empreendimentos no CRM: ${crmEmps.length}`);
    crmEmps.slice(0, 3).forEach(e => {
      console.log(`   - ID ${e.id}: ${e.nome} (${e.situacao})`);
    });
    console.log('');

    // 2. Verificar publicados no site
    const siteEmps = await sql`
      SELECT id, nome, crm_empreendimento_id, status_publicacao 
      FROM site_public_empreendimentos 
      ORDER BY updated_at DESC 
      LIMIT 10
    `;

    console.log(`✅ Empreendimentos publicados no site: ${siteEmps.length}`);
    siteEmps.slice(0, 3).forEach(e => {
      console.log(`   - ${e.nome} (CRM ID: ${e.crm_empreendimento_id}, Status: ${e.status_publicacao})`);
    });
    console.log('');

    // 3. Verificar imagens
    const mediaAssets = await sql`
      SELECT empreendimento_id, COUNT(*) as count, MAX(is_primary) as tem_destaque
      FROM site_public_media_assets 
      GROUP BY empreendimento_id
      ORDER BY count DESC
      LIMIT 5
    `;

    console.log(`✅ Imagens no site: ${mediaAssets.length} empreendimentos com mídia`);
    mediaAssets.forEach(m => {
      console.log(`   - Empreendimento ${m.empreendimento_id}: ${m.count} imagens${m.tem_destaque ? ' ✨ (com destaque)' : ''}`);
    });
    console.log('');

    // 4. Verificar visibilidade de unidades
    const unitVisibility = await sql`
      SELECT cv_empreendimento_id, COUNT(*) as visible_count
      FROM site_public_unit_visibility 
      WHERE visible_on_site = true
      GROUP BY cv_empreendimento_id
      ORDER BY visible_count DESC
      LIMIT 5
    `;

    console.log(`✅ Unidades publicadas: ${unitVisibility.length} empreendimentos têm unidades visíveis`);
    unitVisibility.forEach(u => {
      console.log(`   - Empreendimento ${u.cv_empreendimento_id}: ${u.visible_count} unidades visíveis`);
    });
    console.log('');

    console.log('📋 Resumo:');
    console.log(`   CRM Total: ${crmEmps.length || '?'} empreendimentos`);
    console.log(`   Site Publicados: ${siteEmps.length || 0} empreendimentos`);
    console.log(`   Cobertura: ${siteEmps.length ? ((siteEmps.length / crmEmps.length) * 100).toFixed(1) : 0}%`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

validateSync();
