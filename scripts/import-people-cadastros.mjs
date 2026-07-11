import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import XLSX from 'xlsx';

const ROOT = process.cwd();
const DEFAULT_FILE = path.join(ROOT, 'Cópia de Base_cadastrais_Painel-LV.xlsx');
const TEMP_PASSWORD = 'Sucesso$2026';
const GENERATED_EMAIL_DOMAIN = 'acesso.longview.local';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1].trim();
    if (process.env[key]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugify(value) {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '');
}

function isManagerialPosition(position) {
  const value = normalizeKey(position);
  return value.includes('gerent') || value.includes('coorden') || value.includes('supervisor') || value.includes('gestor');
}

function buildPermissions(area, cargo, category) {
  const base = {
    viewMarketingDashboard: false,
    viewMarketingLeads: false,
    viewMarketingOportunidades: false,
    viewMarketingEstoque: false,
    viewMarketingAds: false,
    viewMarketingVendas: false,
    viewProjectVision: false,
    manageProjects: false,
    manageCommentsDocs: false,
    deleteTasks: false,
    viewPeopleVision: false,
    viewQualityVision: false,
    viewSalesVision: false,
    isAdmin: false,
  };

  if (category === 'fornecedor') {
    return {
      ...base,
      viewProjectVision: true,
      viewPeopleVision: true,
      manageCommentsDocs: true,
    };
  }

  const areaKey = normalizeKey(area);
  const managerial = isManagerialPosition(cargo);

  if (areaKey.includes('dire')) {
    return {
      ...base,
      viewMarketingDashboard: true,
      viewMarketingLeads: true,
      viewMarketingOportunidades: true,
      viewMarketingEstoque: true,
      viewMarketingAds: true,
      viewMarketingVendas: true,
      viewProjectVision: true,
      manageProjects: true,
      manageCommentsDocs: true,
      viewPeopleVision: true,
      viewQualityVision: true,
      viewSalesVision: true,
      isAdmin: true,
    };
  }

  if (areaKey.includes('finance')) {
    return {
      ...base,
      viewMarketingDashboard: true,
      viewMarketingLeads: true,
      viewMarketingOportunidades: true,
      viewMarketingEstoque: true,
      viewMarketingAds: true,
      viewMarketingVendas: true,
      viewProjectVision: true,
      viewPeopleVision: true,
      viewQualityVision: true,
      viewSalesVision: true,
    };
  }

  if (areaKey.includes('engenharia')) {
    return {
      ...base,
      viewProjectVision: true,
      viewPeopleVision: true,
      viewQualityVision: true,
      manageProjects: managerial,
      manageCommentsDocs: managerial,
    };
  }

  if (areaKey.includes('suprimentos')) {
    return {
      ...base,
      viewProjectVision: true,
      viewPeopleVision: true,
      manageProjects: managerial,
      manageCommentsDocs: managerial,
    };
  }

  if (areaKey.includes('relacionamento')) {
    return {
      ...base,
      viewMarketingDashboard: true,
      viewMarketingLeads: true,
      viewMarketingOportunidades: true,
      viewMarketingEstoque: true,
      viewMarketingAds: true,
      viewMarketingVendas: true,
      viewPeopleVision: true,
      viewSalesVision: true,
    };
  }

  if (areaKey.includes('marketing')) {
    return {
      ...base,
      viewMarketingDashboard: true,
      viewMarketingLeads: true,
      viewMarketingOportunidades: true,
      viewMarketingEstoque: true,
      viewMarketingAds: true,
      viewMarketingVendas: true,
      viewPeopleVision: true,
    };
  }

  if (areaKey.includes('comercial')) {
    return {
      ...base,
      viewMarketingDashboard: true,
      viewMarketingLeads: true,
      viewMarketingOportunidades: true,
      viewMarketingEstoque: true,
      viewMarketingAds: true,
      viewMarketingVendas: true,
      viewPeopleVision: true,
      viewSalesVision: true,
    };
  }

  return {
    ...base,
    viewPeopleVision: true,
  };
}

function buildRole(area, cargo, category) {
  if (category === 'fornecedor') return 'Parceiro';
  if (normalizeKey(area).includes('dire')) return 'Diretoria';
  return isManagerialPosition(cargo) ? 'Gestor' : 'Operador';
}

function mergeProfile(existing, incoming) {
  return {
    ...(existing ?? {}),
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== undefined && value !== '')),
    address: existing?.address,
    emergencyContact: existing?.emergencyContact,
    notes: existing?.notes ?? incoming.notes,
    mustChangePassword: existing?.mustChangePassword ?? incoming.mustChangePassword,
  };
}

function generatedEmail(prefix, name, code) {
  const slug = slugify(name || code || crypto.randomUUID().slice(0, 8)) || crypto.randomUUID().slice(0, 8);
  const codePart = slugify(code || '').replace(/\./g, '') || 'semcodigo';
  return `${prefix}.${slug}.${codePart}@${GENERATED_EMAIL_DOMAIN}`;
}

function mergeImportedRow(base, incoming) {
  return {
    ...base,
    ...incoming,
    permissions: incoming.permissions ?? base.permissions,
    profile: {
      ...(base.profile ?? {}),
      ...(incoming.profile ?? {}),
      notes: [base.profile?.notes, incoming.profile?.notes].filter(Boolean).join(' | '),
    },
  };
}

function dedupeImportedRows(rows) {
  const deduped = new Map();
  for (const row of rows) {
    const key = `${row.source}:${normalizeKey(row.email || row.name)}`;
    const existing = deduped.get(key);
    deduped.set(key, existing ? mergeImportedRow(existing, row) : row);
  }
  return Array.from(deduped.values());
}

function buildInternalRows(workbook) {
  const sheet = workbook.Sheets.Base_Cadastrais_Interno;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.map((row) => {
    const area = normalizeText(row['Área']);
    const cargo = normalizeText(row['Cargo']);
    const name = normalizeText(row['Nome']);
    const email = normalizeText(row['E-mail']).toLowerCase();
    const phone = normalizeText(row['Telefone']);
    return {
      source: 'interno',
      area,
      cargo,
      name,
      email,
      phone,
      role: buildRole(area, cargo, 'colaborador'),
      permissions: buildPermissions(area, cargo, 'colaborador'),
      profile: {
        category: 'colaborador',
        department: area,
        position: cargo,
        phone,
        whatsapp: phone,
        company: 'LongView',
        status: 'ativo',
      },
    };
  }).filter((row) => row.name);
}

function buildSupplierRows(workbook) {
  const sheet = workbook.Sheets.Base_Cadastrais_Fornecedores_pr;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.map((row) => {
    const responsible = normalizeText(row['Responsável']);
    const company = normalizeText(row['Empresa - Nome fantasia']) || normalizeText(row['Fornecedor (SIENGE)']) || 'Fornecedor';
    const code = normalizeText(row['Cód']);
    const email = normalizeText(row['E-mail']).toLowerCase();
    const phone = normalizeText(row['Telefone']);
    const specialty = normalizeText(row['Especialidade']);
    const empreendimento = normalizeText(row['Empreendimento']);
    const name = responsible || company;

    return {
      source: 'fornecedor',
      area: 'Fornecedores',
      cargo: specialty || 'Fornecedor',
      name,
      email: email || generatedEmail('fornecedor', name, code),
      phone,
      role: buildRole('Fornecedores', specialty, 'fornecedor'),
      permissions: buildPermissions('Fornecedores', specialty, 'fornecedor'),
      profile: {
        category: 'fornecedor',
        department: 'Fornecedores',
        position: specialty || 'Fornecedor',
        phone,
        whatsapp: phone,
        company,
        status: 'ativo',
        notes: [empreendimento && `Empreendimento: ${empreendimento}`, code && `Código: ${code}`].filter(Boolean).join(' | '),
      },
    };
  }).filter((row) => row.name);
}

function parseArgs(argv) {
  const args = { file: DEFAULT_FILE, apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    if (token === '--file' && argv[i + 1]) {
      args.file = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

async function main() {
  const { file, apply } = parseArgs(process.argv);
  loadEnvFile(path.join(ROOT, '.env.local'));
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo não encontrado: ${file}`);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada.');
  }

  const workbook = XLSX.readFile(file);
  const internalRows = buildInternalRows(workbook);
  const supplierRows = buildSupplierRows(workbook);
  const importedRows = dedupeImportedRows([...internalRows, ...supplierRows]);

  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    const rows = await sql`SELECT data FROM app_users ORDER BY created_at`;
    const users = rows.map((row) => (typeof row.data === 'object' ? row.data : JSON.parse(row.data)));

    const byEmail = new Map(users.map((user) => [normalizeKey(user.email), user]));
    const byName = new Map(users.map((user) => [normalizeKey(user.name), user]));
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);

    const summary = {
      totalPlan: importedRows.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      createdInternal: 0,
      createdSuppliers: 0,
      updatedInternal: 0,
      updatedSuppliers: 0,
    };

    for (const row of importedRows) {
      const existing = byEmail.get(normalizeKey(row.email)) ?? (row.source === 'interno' ? byName.get(normalizeKey(row.name)) : undefined);
      const nextUser = existing
        ? {
            ...existing,
            name: existing.name || row.name,
            email: existing.email || row.email,
            role: row.role,
            permissions: row.permissions,
            profile: mergeProfile(existing.profile, row.profile),
          }
        : {
            id: `usr-${crypto.randomUUID()}`,
            name: row.name,
            email: row.email,
            passwordHash,
            role: row.role,
            permissions: row.permissions,
            createdAt: new Date().toISOString(),
            profile: mergeProfile(undefined, {
              ...row.profile,
              mustChangePassword: true,
            }),
          };

      byEmail.set(normalizeKey(nextUser.email), nextUser);
      byName.set(normalizeKey(nextUser.name), nextUser);

      const hasChanged = !existing || JSON.stringify(existing) !== JSON.stringify(nextUser);
      if (!hasChanged) {
        summary.unchanged += 1;
        continue;
      }

      if (existing) {
        summary.updated += 1;
        if (row.source === 'interno') summary.updatedInternal += 1;
        else summary.updatedSuppliers += 1;
      } else {
        summary.created += 1;
        if (row.source === 'interno') summary.createdInternal += 1;
        else summary.createdSuppliers += 1;
      }

      if (apply) {
        await sql`
          INSERT INTO app_users (id, email, password_hash, name, role, permissions, data, created_at)
          VALUES (${nextUser.id}, ${nextUser.email}, ${nextUser.passwordHash}, ${nextUser.name}, ${nextUser.role}, ${JSON.stringify(nextUser.permissions)}, ${JSON.stringify(nextUser)}, ${nextUser.createdAt})
          ON CONFLICT (email) DO UPDATE SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            permissions = EXCLUDED.permissions,
            data = EXCLUDED.data
        `;
      }
    }

    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', file, summary }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
