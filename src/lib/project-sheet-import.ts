import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import type { Project, ProjectDatabaseState, Responsible, Task } from './db-kv';

export const DEFAULT_PROJECT_SHEET_PATH = path.join(
  process.cwd(),
  'data',
  'Andamentos Projetos - LONGVIEW - GERAL.csv'
);

interface SheetTaskBuildResult {
  state: ProjectDatabaseState;
  report: ProjectSheetImportReport;
}

interface ProjectImportStats {
  project: string;
  importedTasks: number;
  operationalRows: number;
  templateOnlyRows: number;
  skippedRows: number;
}

export interface ProjectSheetImportReport {
  source: string;
  format: 'csv' | 'xlsx';
  totalRows: number;
  importedTasks: number;
  skippedRows: number;
  templateOnlyRows: number;
  operationalRows: number;
  projects: string[];
  perProject: ProjectImportStats[];
  sectors: string[];
  responsibles: number;
  statusAndamento: Record<string, number>;
  urgencias: Record<string, number>;
  warnings: string[];
  importedAt: string;
  sampleTasks: Array<Pick<Task, 'id' | 'project' | 'sector' | 'subject' | 'responsible' | 'secondaryResponsibles' | 'statusContratacao' | 'statusAndamento' | 'urgencia' | 'inicio' | 'previsaoEntrega' | 'entregaEfetiva' | 'progress'>>;
}

const REQUIRED_HEADERS = [
  'Geral',
  'Assunto',
  'Status da Contratação',
  'Responsável pela execução',
  '?!',
  'Situação',
  'Status Andamento',
  'Início',
  'Previsão de entrega',
  'Entrega Efetiva',
  'Observações e Rotinas',
] as const;

const PROJECT_BANNERS: Record<string, string> = {
  'villa-alta': 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&auto=format&fit=crop&q=80',
  varandas: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
  jeriva: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&auto=format&fit=crop&q=80',
  ride: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
  altana: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&auto=format&fit=crop&q=80',
  cacupe: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&auto=format&fit=crop&q=80',
};

function parseCSV(content: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(currentValue.trim());
      currentValue = '';
    } else if (char === '\r' || char === '\n') {
      row.push(currentValue.trim());
      currentValue = '';
      if (row.some(Boolean)) result.push(row);
      row = [];
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      currentValue += char;
    }
  }

  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(Boolean)) result.push(row);
  }

  return result;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function normalizeHeader(value: string): string {
  return normalizeValue(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getCell(row: string[], headers: string[], header: string): string {
  const idx = headers.indexOf(normalizeHeader(header));
  return idx === -1 ? '' : normalizeValue(row[idx]);
}

function parseStatus(raw: string, contratacao: string): Task['statusAndamento'] {
  const contractValue = contratacao.toLowerCase();
  if (contractValue.includes('não será contratado') || contractValue.includes('nao sera contratado')) return 'Finalizado';

  const value = raw.toLowerCase();
  if (value.includes('não se aplica') || value.includes('nao se aplica')) return 'Finalizado';
  if (value.includes('finalizado') || value.includes('concluído') || value.includes('concluido')) return 'Finalizado';
  if (value.includes('em andamento')) return 'Em andamento';
  if (value.includes('aguardando') || value.includes('espera')) return 'Aguardando';
  if (value.includes('análise') || value.includes('analise')) return 'Em análise';
  if (value.includes('não iniciado') || value.includes('nao iniciado')) return 'Não iniciado';
  return value ? 'Em andamento' : 'Não iniciado';
}

function parseUrgencia(raw: string): Task['urgencia'] {
  const value = raw.toLowerCase();
  if (raw === '!' || value.includes('critica') || value.includes('crítica')) return 'Crítica';
  if (raw === '?' || value.includes('media') || value.includes('média')) return 'Média';
  if (value.includes('emergencial')) return 'Emergencial';
  if (value.includes('alta')) return 'Alta';
  return 'Baixa';
}

function progressFromStatus(status: Task['statusAndamento']): number {
  if (status === 'Finalizado') return 100;
  if (status === 'Em análise') return 80;
  if (status === 'Em andamento') return 50;
  if (status === 'Aguardando') return 25;
  return 0;
}

function splitResponsibles(raw: string): { primary: string; secondary: string[] } {
  if (!raw || raw === '-') return { primary: 'Não atribuído', secondary: [] };

  const parts = raw
    .split(/[/,]| e /)
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) return { primary: 'Não atribuído', secondary: [] };
  return { primary: parts[0], secondary: parts.slice(1) };
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

function hasOperationalData(row: Record<string, string>): boolean {
  return REQUIRED_HEADERS.some((header) => {
    if (header === 'Geral' || header === 'Assunto') return false;
    return Boolean(row[header]);
  });
}

function createTask(
  input: {
    project: string;
    row: Record<string, string>;
    id: string;
    importedAt: string;
    isTemplateOnly: boolean;
  }
): Task {
  const sector = input.row.Geral || 'Gestão';
  const statusContratacao = input.row['Status da Contratação'] || 'Indefinido';
  const statusAndamento = input.isTemplateOnly
    ? 'Não iniciado'
    : parseStatus(input.row['Status Andamento'], statusContratacao);
  const urgencia = parseUrgencia(input.row['?!']);
  const situacao = input.row.Situação || '';
  const observacoesRotinas = input.row['Observações e Rotinas'] || '';
  const { primary, secondary } = splitResponsibles(input.row['Responsável pela execução']);

  return {
    id: input.id,
    project: input.project,
    sector,
    subject: input.row.Assunto || 'Sem Assunto',
    description: `Rotina operacional do setor de ${sector}.`,
    responsible: primary,
    secondaryResponsibles: secondary,
    statusContratacao,
    statusAndamento,
    urgencia,
    inicio: input.row.Início || '',
    previsaoEntrega: input.row['Previsão de entrega'] || '',
    entregaEfetiva: input.row['Entrega Efetiva'] || '',
    situacao,
    observacoesRotinas,
    progress: progressFromStatus(statusAndamento),
    subtasks: [],
    comments: situacao
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 10)
      .map((line, commentIndex) => ({
        id: `c-import-${input.id}-${commentIndex + 1}`,
        userId: 'usr-import',
        userName: primary !== 'Não atribuído' ? primary : 'Importador LongView',
        role: 'Equipe Interna',
        content: line,
        createdAt: input.importedAt,
      })),
    documents: [],
    logs: [{
      id: `log-${input.id}-1`,
      field: input.isTemplateOnly ? 'importacao-modelo' : 'importacao',
      oldValue: 'Planilha',
      newValue: statusAndamento,
      userName: 'Importador LongView',
      date: input.importedAt,
    }],
    dependencies: [],
    tags: [sector].filter(Boolean),
  };
}

function buildResult(
  params: {
    tasks: Task[];
    source: string;
    format: 'csv' | 'xlsx';
    totalRows: number;
    skippedRows: number;
    templateOnlyRows: number;
    operationalRows: number;
    perProject: ProjectImportStats[];
    warnings: string[];
    importedAt: string;
  }
): SheetTaskBuildResult {
  const projects = buildProjects(params.tasks);
  const responsibles = buildResponsibles(params.tasks);
  const sectors = [...new Set(params.tasks.map((task) => task.sector))].sort();
  const statusAndamento: Record<string, number> = {};
  const urgencias: Record<string, number> = {};
  params.tasks.forEach((task) => {
    increment(statusAndamento, task.statusAndamento);
    increment(urgencias, task.urgencia);
  });

  return {
    state: { tasks: params.tasks, projects, responsibles },
    report: {
      source: params.source,
      format: params.format,
      totalRows: params.totalRows,
      importedTasks: params.tasks.length,
      skippedRows: params.skippedRows,
      templateOnlyRows: params.templateOnlyRows,
      operationalRows: params.operationalRows,
      projects: projects.map((project) => project.name),
      perProject: params.perProject,
      sectors,
      responsibles: responsibles.length,
      statusAndamento,
      urgencias,
      warnings: params.warnings,
      importedAt: params.importedAt,
      sampleTasks: params.tasks.slice(0, 10).map((task) => ({
        id: task.id,
        project: task.project,
        sector: task.sector,
        subject: task.subject,
        responsible: task.responsible,
        secondaryResponsibles: task.secondaryResponsibles,
        statusContratacao: task.statusContratacao,
        statusAndamento: task.statusAndamento,
        urgencia: task.urgencia,
        inicio: task.inicio,
        previsaoEntrega: task.previsaoEntrega,
        entregaEfetiva: task.entregaEfetiva,
        progress: task.progress,
      })),
    },
  };
}

export function buildProjectDataFromCsv(content: string, source = 'inline csv'): SheetTaskBuildResult {
  const rows = parseCSV(content);
  const warnings: string[] = [];
  const importedAt = new Date().toISOString();
  if (rows.length === 0) {
    warnings.push('Planilha sem linhas legíveis.');
    return buildResult({
      tasks: [],
      source,
      format: 'csv',
      totalRows: 0,
      skippedRows: 0,
      templateOnlyRows: 0,
      operationalRows: 0,
      perProject: [],
      warnings,
      importedAt,
    });
  }

  const headers = rows[0].map(normalizeHeader);
  const requiredHeaders = ['empreendimento', 'responsavel pela execucao', 'geral', 'assunto'];
  requiredHeaders.forEach((header) => {
    if (!headers.includes(header)) warnings.push(`Coluna obrigatória ausente: ${header}`);
  });

  const tasks: Task[] = [];
  let skippedRows = 0;
  let templateOnlyRows = 0;
  let operationalRows = 0;
  const perProjectMap = new Map<string, ProjectImportStats>();

  rows.slice(1).forEach((row) => {
    const project = getCell(row, headers, 'EMPREENDIMENTO');
    const subject = getCell(row, headers, 'Assunto');
    if (!project || !subject) {
      skippedRows++;
      return;
    }

    const taskRow: Record<string, string> = {
      Geral: getCell(row, headers, 'Geral') || 'Gestão',
      Assunto: subject,
      'Status da Contratação': getCell(row, headers, 'Status da Contratação') || 'Indefinido',
      'Responsável pela execução': getCell(row, headers, 'Responsável pela execução'),
      '?!': getCell(row, headers, '?!'),
      Situação: getCell(row, headers, 'Situação'),
      'Status Andamento': getCell(row, headers, 'Status Andamento'),
      Início: getCell(row, headers, 'Início'),
      'Previsão de entrega': getCell(row, headers, 'Previsão de entrega'),
      'Entrega Efetiva': getCell(row, headers, 'Entrega Efetiva'),
      'Observações e Rotinas': getCell(row, headers, 'Observações e Rotinas'),
    };
    const isTemplateOnly = !hasOperationalData(taskRow);
    if (isTemplateOnly) templateOnlyRows++;
    else operationalRows++;

    const id = `LVM-${String(tasks.length + 1).padStart(4, '0')}`;
    tasks.push(createTask({ project, row: taskRow, id, importedAt, isTemplateOnly }));

    const stats = perProjectMap.get(project) ?? {
      project,
      importedTasks: 0,
      operationalRows: 0,
      templateOnlyRows: 0,
      skippedRows: 0,
    };
    stats.importedTasks++;
    if (isTemplateOnly) stats.templateOnlyRows++;
    else stats.operationalRows++;
    perProjectMap.set(project, stats);
  });

  if (skippedRows > 0) warnings.push(`${skippedRows} linhas ignoradas por falta de empreendimento ou assunto.`);

  return buildResult({
    tasks,
    source,
    format: 'csv',
    totalRows: Math.max(rows.length - 1, 0),
    skippedRows,
    templateOnlyRows,
    operationalRows,
    perProject: [...perProjectMap.values()],
    warnings,
    importedAt,
  });
}

export function buildProjectDataFromXlsx(buffer: Buffer, source = 'uploaded xlsx'): SheetTaskBuildResult {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
  });
  const importedAt = new Date().toISOString();
  const warnings: string[] = [];
  const tasks: Task[] = [];
  const perProject: ProjectImportStats[] = [];
  let totalRows = 0;
  let skippedRows = 0;
  let templateOnlyRows = 0;
  let operationalRows = 0;

  workbook.SheetNames.forEach((sheetName) => {
    if (normalizeHeader(sheetName) === 'matriz') return;

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    }).map((row) => row.map(normalizeValue));

    if (rows.length < 2) {
      warnings.push(`${sheetName}: aba sem linha de cabeçalho.`);
      return;
    }

    const projectCell = normalizeValue(rows[0]?.[1]);
    const project = projectCell && normalizeHeader(projectCell) !== 'nome' ? projectCell : sheetName;
    const headers = rows[1].map(normalizeHeader);
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(normalizeHeader(header)));
    if (missingHeaders.length > 0) {
      warnings.push(`${sheetName}: colunas ausentes (${missingHeaders.join(', ')}).`);
    }

    const stats: ProjectImportStats = {
      project,
      importedTasks: 0,
      operationalRows: 0,
      templateOnlyRows: 0,
      skippedRows: 0,
    };

    rows.slice(2).forEach((row) => {
      const sector = getCell(row, headers, 'Geral');
      const subject = getCell(row, headers, 'Assunto');
      if (!sector && !subject) return;
      totalRows++;

      if (!subject) {
        skippedRows++;
        stats.skippedRows++;
        return;
      }

      const taskRow: Record<string, string> = {
        Geral: sector || 'Gestão',
        Assunto: subject,
        'Status da Contratação': getCell(row, headers, 'Status da Contratação') || 'Indefinido',
        'Responsável pela execução': getCell(row, headers, 'Responsável pela execução'),
        '?!': getCell(row, headers, '?!'),
        Situação: getCell(row, headers, 'Situação'),
        'Status Andamento': getCell(row, headers, 'Status Andamento'),
        Início: getCell(row, headers, 'Início'),
        'Previsão de entrega': getCell(row, headers, 'Previsão de entrega'),
        'Entrega Efetiva': getCell(row, headers, 'Entrega Efetiva'),
        'Observações e Rotinas': getCell(row, headers, 'Observações e Rotinas'),
      };
      const isTemplateOnly = !hasOperationalData(taskRow);
      if (isTemplateOnly) {
        templateOnlyRows++;
        stats.templateOnlyRows++;
      } else {
        operationalRows++;
        stats.operationalRows++;
      }

      const id = `LVM-${String(tasks.length + 1).padStart(4, '0')}`;
      tasks.push(createTask({ project, row: taskRow, id, importedAt, isTemplateOnly }));
      stats.importedTasks++;
    });

    perProject.push(stats);
  });

  if (tasks.length === 0) warnings.push('Nenhuma tarefa importável encontrada.');
  if (templateOnlyRows > 0) {
    warnings.push(`${templateOnlyRows} tarefas sem dados operacionais foram mantidas como Não iniciado.`);
  }

  return buildResult({
    tasks,
    source,
    format: 'xlsx',
    totalRows,
    skippedRows,
    templateOnlyRows,
    operationalRows,
    perProject,
    warnings,
    importedAt,
  });
}

function buildProjects(tasks: Task[]): Project[] {
  return [...new Set(tasks.map((task) => task.project))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((name) => {
      const projectTasks = tasks.filter((task) => task.project === name);
      const finished = projectTasks.filter((task) => task.statusAndamento === 'Finalizado').length;
      const progress = projectTasks.length > 0 ? Math.round((finished / projectTasks.length) * 100) : 0;
      const id = slugify(name);

      return {
        id,
        name,
        description: `Empreendimento importado da planilha operacional LongView.`,
        status: progress === 100 ? 'Finalizado' : progress > 0 ? 'Em andamento' : 'Não iniciado',
        progress,
        banner: PROJECT_BANNERS[id] || 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&auto=format&fit=crop&q=80',
      };
    });
}

function buildResponsibles(tasks: Task[]): Responsible[] {
  const names = new Set<string>();
  tasks.forEach((task) => {
    if (task.responsible && task.responsible !== 'Não atribuído' && task.responsible !== '-') names.add(task.responsible);
    task.secondaryResponsibles.forEach((name) => {
      if (name && name !== 'Não atribuído' && name !== '-') names.add(name);
    });
  });

  return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((name, index) => ({
    id: `resp-${index + 1}`,
    name,
    phone: '',
    email: `${slugify(name).replace(/-/g, '.')}@longview.com.br`,
    company: name.toLowerCase().includes('lv') ? 'LongView' : 'Parceiro Técnico',
  }));
}

export function readProjectDataFromDefaultSheet(): SheetTaskBuildResult {
  const content = fs.readFileSync(DEFAULT_PROJECT_SHEET_PATH, 'utf-8');
  return buildProjectDataFromCsv(content, DEFAULT_PROJECT_SHEET_PATH);
}
