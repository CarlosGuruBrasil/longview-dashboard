import fs from 'fs';
import path from 'path';
import logger from '@/lib/logger'

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  role: 'Diretoria' | 'Equipe Interna' | 'Parceiro';
  content: string;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  category: string;
  uploadDate: string;
  uploader: string;
  size?: string;
  version: number;
  url: string;
}

export interface ChangeLog {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  userName: string;
  date: string;
}

export interface Task {
  id: string;
  project: string;
  sector: string;
  subject: string;
  description: string;
  responsible: string;
  secondaryResponsibles: string[];
  statusContratacao: string;
  statusAndamento: 'Não iniciado' | 'Em andamento' | 'Aguardando' | 'Em análise' | 'Finalizado';
  urgencia: 'Baixa' | 'Média' | 'Alta' | 'Crítica' | 'Emergencial';
  inicio: string;
  previsaoEntrega: string;
  entregaEfetiva: string;
  situacao: string;
  observacoesRotinas: string;
  progress: number;
  subtasks: Subtask[];
  comments: Comment[];
  documents: Document[];
  logs: ChangeLog[];
  dependencies: string[];
  tags: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  banner: string;
}

export interface Responsible {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  photo?: string;
  photoPosition?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface DatabaseState {
  tasks: Task[];
  projects: Project[];
  users: { id: string; name: string; role: string; email: string }[];
  responsibles: Responsible[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const CSV_FILE = path.join(DATA_DIR, 'Andamentos Projetos - LONGVIEW - GERAL.csv');

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
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentValue.trim());
        currentValue = '';
      } else if (char === '\r' || char === '\n') {
        row.push(currentValue.trim());
        currentValue = '';
        if (row.length > 0 && row.some(val => val !== '')) {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        currentValue += char;
      }
    }
  }

  if (currentValue !== '' || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(val => val !== '')) {
      result.push(row);
    }
  }

  return result;
}

function initializeFromCSV(): DatabaseState {
  const defaultProjects: Project[] = [
    { id: 'villa-alta', name: 'Villa Alta', description: 'Empreendimento de alto padrão com vista privilegiada para o mar.', status: 'Em andamento', progress: 0, banner: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&auto=format&fit=crop&q=80' },
    { id: 'varandas', name: 'Varandas', description: 'Condomínio residencial sofisticado focado em varandas gourmet amplas.', status: 'Aguardando Aprovação', progress: 0, banner: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80' },
    { id: 'jeriva', name: 'Jerivá', description: 'Planejamento e urbanização integrados à natureza local.', status: 'Em andamento', progress: 0, banner: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&auto=format&fit=crop&q=80' },
    { id: 'ride', name: 'Ride', description: 'Sofisticação e conectividade com a melhor infraestrutura corporativa.', status: 'Em andamento', progress: 0, banner: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80' },
    { id: 'altana', name: 'Altana', description: 'Exclusividade e arquitetura arrojada em excelente localização.', status: 'Não iniciado', progress: 0, banner: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&auto=format&fit=crop&q=80' },
    { id: 'cacupei', name: 'Cacupé', description: 'Casas boutique de luxo situadas na valorizada região de Cacupé.', status: 'Não iniciado', progress: 0, banner: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&auto=format&fit=crop&q=80' },
  ];

  const defaultUsers = [
    { id: 'usr-1', name: 'Carlos Santos (Diretoria)', role: 'Diretoria', email: 'carlos@longview.com.br' },
    { id: 'usr-2', name: 'Michele Lima', role: 'Equipe Interna', email: 'michele@longview.com.br' },
    { id: 'usr-3', name: 'Carol Silva', role: 'Equipe Interna', email: 'carol@longview.com.br' },
    { id: 'usr-4', name: 'Margarete Pereira', role: 'Equipe Interna', email: 'margarete@longview.com.br' },
    { id: 'usr-5', name: 'Guto - LV', role: 'Equipe Interna', email: 'guto@longview.com.br' },
    { id: 'usr-6', name: 'Parceiro Técnico', role: 'Parceiro', email: 'parceiro@gmail.com' }
  ];

  if (!fs.existsSync(CSV_FILE)) {
    logger.error('Planilha CSV não encontrada. Inicializando estado vazio.');
    return { tasks: [], projects: defaultProjects, users: defaultUsers, responsibles: [] };
  }

  try {
    const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const parsedLines = parseCSV(csvContent);
    
    if (parsedLines.length <= 1) {
      return { tasks: [], projects: defaultProjects, users: defaultUsers, responsibles: [] };
    }

    const headers = parsedLines[0].map(h => h.toLowerCase());
    
    const idxEmpreendimento = headers.indexOf('empreendimento');
    const idxResponsavel = headers.indexOf('responsável pela execução');
    const idxGeral = headers.indexOf('geral');
    const idxAssunto = headers.indexOf('assunto');
    const idxStatusContratacao = headers.indexOf('status da contratação');
    const idxUrgencia = headers.indexOf('?!');
    const idxSituacao = headers.indexOf('situação');
    const idxStatusAndamento = headers.indexOf('status andamento');
    const idxInicio = headers.indexOf('início');
    const idxPrevisaoEntrega = headers.indexOf('previsão de entrega');
    const idxEntregaEfetiva = headers.indexOf('entrega efetiva');
    const idxObservacoes = headers.indexOf('observações e rotinas');

    const tasks: Task[] = [];
    let idCounter = 1;

    for (let i = 1; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      if (line.length < 3) continue;

      const rawEmpreendimento = idxEmpreendimento !== -1 ? line[idxEmpreendimento] : '';
      if (!rawEmpreendimento) continue;

      const rawStatusAndamento = idxStatusAndamento !== -1 ? line[idxStatusAndamento] : '';
      let statusAndamento: Task['statusAndamento'] = 'Não iniciado';
      const statusLower = rawStatusAndamento.toLowerCase();
      if (statusLower.includes('finalizado') || statusLower.includes('concluído') || statusLower.includes('concluido')) {
        statusAndamento = 'Finalizado';
      } else if (statusLower.includes('em andamento')) {
        statusAndamento = 'Em andamento';
      } else if (statusLower.includes('aguardando') || statusLower.includes('espera')) {
        statusAndamento = 'Aguardando';
      } else if (statusLower.includes('análise') || statusLower.includes('analise')) {
        statusAndamento = 'Em análise';
      } else if (statusLower.includes('não iniciado') || statusLower.includes('nao iniciado')) {
        statusAndamento = 'Não iniciado';
      } else if (statusLower !== '') {
        statusAndamento = 'Em andamento';
      }

      const rawStatusContratacao = idxStatusContratacao !== -1 ? line[idxStatusContratacao] : '';
      if (rawStatusContratacao.toLowerCase().includes('não será contratado')) {
        statusAndamento = 'Finalizado';
      }

      const rawUrgencia = idxUrgencia !== -1 ? line[idxUrgencia] : '';
      let urgencia: Task['urgencia'] = 'Baixa';
      if (rawUrgencia === '!' || rawUrgencia.toLowerCase().includes('critica') || rawUrgencia.toLowerCase().includes('crítica')) {
        urgencia = 'Crítica';
      } else if (rawUrgencia === '?' || rawUrgencia.toLowerCase().includes('media') || rawUrgencia.toLowerCase().includes('média')) {
        urgencia = 'Média';
      } else if (rawUrgencia.toLowerCase().includes('emergencial')) {
        urgencia = 'Emergencial';
      } else if (rawUrgencia.toLowerCase().includes('alta')) {
        urgencia = 'Alta';
      }

      const rawResponsavel = idxResponsavel !== -1 ? line[idxResponsavel] : '';
      let primaryResp = 'Não atribuído';
      let secondaryResps: string[] = [];

      if (rawResponsavel && rawResponsavel !== '-') {
        const parts = rawResponsavel.split(/[/,]| e /).map(r => r.trim()).filter(Boolean);
        if (parts.length > 0) {
          primaryResp = parts[0];
          secondaryResps = parts.slice(1);
        }
      }

      const rawSituacao = idxSituacao !== -1 ? line[idxSituacao] : '';
      const rawObservacoes = idxObservacoes !== -1 ? line[idxObservacoes] : '';
      const rawSector = idxGeral !== -1 ? line[idxGeral] : 'Gestão';

      let progress = 0;
      if (statusAndamento === 'Finalizado') {
        progress = 100;
      } else if (statusAndamento === 'Em andamento') {
        progress = 50;
      } else if (statusAndamento === 'Em análise') {
        progress = 80;
      } else if (statusAndamento === 'Aguardando') {
        progress = 25;
      }

      const comments: Comment[] = [];
      if (rawSituacao && rawSituacao.length > 10) {
        const commentLines = rawSituacao.split('\n');
        commentLines.forEach((cline, idx) => {
          if (cline.trim()) {
            comments.push({
              id: `c-init-${idCounter}-${idx}`,
              userId: 'usr-4',
              userName: primaryResp !== 'Não atribuído' ? primaryResp : 'Michele Lima',
              role: 'Equipe Interna',
              content: cline.trim(),
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      const task: Task = {
        id: `LVM-${String(idCounter).padStart(4, '0')}`,
        project: rawEmpreendimento.trim(),
        sector: rawSector.trim() || 'Gestão',
        subject: idxAssunto !== -1 ? line[idxAssunto].trim() : 'Sem Assunto',
        description: `Rotina operacional do setor de ${rawSector.trim() || 'Gestão'}.`,
        responsible: primaryResp,
        secondaryResponsibles: secondaryResps,
        statusContratacao: rawStatusContratacao.trim() || 'Indefinido',
        statusAndamento,
        urgencia,
        inicio: idxInicio !== -1 ? line[idxInicio].trim() : '',
        previsaoEntrega: idxPrevisaoEntrega !== -1 ? line[idxPrevisaoEntrega].trim() : '',
        entregaEfetiva: idxEntregaEfetiva !== -1 ? line[idxEntregaEfetiva].trim() : '',
        situacao: rawSituacao,
        observacoesRotinas: rawObservacoes,
        progress,
        subtasks: [],
        comments,
        documents: [],
        logs: [
          {
            id: `log-${idCounter}-1`,
            field: 'status',
            oldValue: 'N/A',
            newValue: statusAndamento,
            userName: 'Importador Inteligente',
            date: new Date().toISOString()
          }
        ],
        dependencies: [],
        tags: [rawSector.trim()].filter(Boolean)
      };

      tasks.push(task);
      idCounter++;
    }

    const updatedProjects = defaultProjects.map(proj => {
      const projTasks = tasks.filter(t => t.project.toLowerCase() === proj.name.toLowerCase());
      if (projTasks.length === 0) return proj;
      const finished = projTasks.filter(t => t.statusAndamento === 'Finalizado').length;
      const progress = Math.round((finished / projTasks.length) * 100);
      return {
        ...proj,
        progress,
        status: progress === 100 ? 'Finalizado' : progress > 0 ? 'Em andamento' : 'Não iniciado'
      };
    });

    return { tasks, projects: updatedProjects, users: defaultUsers, responsibles: [] };
  } catch (error) {
    logger.error({ error }, 'Erro ao ler CSV e inicializar banco de dados:');
    return { tasks: [], projects: defaultProjects, users: defaultUsers, responsibles: [] };
  }
}

function initializeResponsibles(tasks: Task[], users: { id: string; name: string; role: string; email: string }[]): Responsible[] {
  const names = new Set<string>();
  tasks.forEach(t => {
    if (t.responsible && t.responsible !== 'Não atribuído' && t.responsible !== '-') {
      names.add(t.responsible);
    }
    if (t.secondaryResponsibles) {
      t.secondaryResponsibles.forEach(sr => {
        if (sr && sr !== 'Não atribuído' && sr !== '-') {
          names.add(sr);
        }
      });
    }
  });

  const responsibles: Responsible[] = [];
  let counter = 1;
  names.forEach(name => {
    const matchedUser = users.find(u => u.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(u.name.toLowerCase()));
    responsibles.push({
      id: `resp-${counter}`,
      name,
      phone: '(48) 99999-9999',
      email: matchedUser ? matchedUser.email : `${name.toLowerCase().replace(/ /g, '.')}@longview.com.br`,
      company: name.toLowerCase().includes('parceiro') || name.toLowerCase().includes('engenharia') ? 'Parceiro Técnico' : 'LongView'
    });
    counter++;
  });
  return responsibles;
}

let cachedDbState: DatabaseState | null = null;

export function readDatabase(): DatabaseState {
  if (cachedDbState) {
    return cachedDbState;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const state = JSON.parse(content);
      if (!state.responsibles) {
        state.responsibles = initializeResponsibles(state.tasks, state.users);
        writeDatabase(state);
      }
      cachedDbState = state;
      return state;
    } catch (e) {
      logger.error({ e }, 'Erro ao ler JSON de banco de dados, reinicializando a partir do CSV...');
    }
  }

  const initialState = initializeFromCSV();
  initialState.responsibles = initializeResponsibles(initialState.tasks, initialState.users);
  writeDatabase(initialState);
  cachedDbState = initialState;
  return initialState;
}

export function writeDatabase(state: DatabaseState): void {
  cachedDbState = state;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}
