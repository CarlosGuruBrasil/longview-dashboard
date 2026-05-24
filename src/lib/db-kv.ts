import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

// Interfaces de Permissões
export interface UserPermissions {
  // Marketing Vision
  viewMarketingDashboard: boolean;
  viewMarketingLeads: boolean;
  viewMarketingOportunidades: boolean;
  viewMarketingEstoque: boolean;
  viewMarketingAds: boolean;
  viewMarketingVendas: boolean;
  // Project Vision
  viewProjectVision: boolean;
  manageProjects: boolean; // criar, editar e atualizar tarefas
  manageCommentsDocs: boolean; // adicionar comentários e documentos
  deleteTasks: boolean; // deletar tarefas
  // Admin
  isAdmin: boolean; // Acesso ao painel de usuários (/admin/users)
}

// Interface de Usuário no Banco
export interface DbUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'Desenvolvedor' | 'Diretoria' | 'Gestor' | 'Parceiro' | 'Corretor';
  permissions: UserPermissions;
  createdAt: string;
}

// Interfaces do Project Vision herdadas
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  role: string;
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
}

export interface ProjectDatabaseState {
  tasks: Task[];
  projects: Project[];
  responsibles: Responsible[];
}

// Configuração do Fallback Local (caso as credenciais do Vercel KV não existam no ambiente)
const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_USERS_FILE = path.join(DATA_DIR, 'users-kv-local.json');
const LOCAL_PROJECTS_FILE = path.join(DATA_DIR, 'projects-kv-local.json');

// Helper para checar se o KV real está disponível
const isKvAvailable = (): boolean => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

// --- IMPLEMENTAÇÃO DO BANCO DE DADOS (COM ADAPTADOR RESILIENTE) ---

// 1. USUÁRIOS
export async function readUsers(): Promise<DbUser[]> {
  if (isKvAvailable()) {
    try {
      const users = await kv.get<DbUser[]>('users_db');
      return users || [];
    } catch (e) {
      console.error('Erro ao ler usuários do Vercel KV, usando fallback local:', e);
    }
  }

  // Fallback Local
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(LOCAL_USERS_FILE)) {
    try {
      const content = fs.readFileSync(LOCAL_USERS_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Erro ao ler usuários locais:', e);
    }
  }
  return [];
}

export async function writeUsers(users: DbUser[]): Promise<void> {
  if (isKvAvailable()) {
    try {
      await kv.set('users_db', users);
      return;
    } catch (e) {
      console.error('Erro ao salvar usuários no Vercel KV, salvando localmente:', e);
    }
  }

  // Salvar Local
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// 2. TAREFAS E PROJETOS (PROJECT VISION)
export async function readProjectData(): Promise<ProjectDatabaseState> {
  if (isKvAvailable()) {
    try {
      const data = await kv.get<ProjectDatabaseState>('projects_db');
      if (data && data.tasks && data.projects) {
        return data;
      }
    } catch (e) {
      console.error('Erro ao ler dados de projetos do Vercel KV, usando fallback local:', e);
    }
  }

  // Fallback Local
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(LOCAL_PROJECTS_FILE)) {
    try {
      const content = fs.readFileSync(LOCAL_PROJECTS_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Erro ao ler dados de projetos locais:', e);
    }
  }
  
  // Tentar migrar do db.json original se existir
  const legacyDbFile = path.join(DATA_DIR, 'db.json');
  if (fs.existsSync(legacyDbFile)) {
    try {
      const content = fs.readFileSync(legacyDbFile, 'utf-8');
      const legacyData = JSON.parse(content);
      const state: ProjectDatabaseState = {
        tasks: legacyData.tasks || [],
        projects: legacyData.projects || [],
        responsibles: legacyData.responsibles || []
      };
      await writeProjectData(state);
      return state;
    } catch (e) {
      console.error('Erro ao migrar dados legados:', e);
    }
  }

  return { tasks: [], projects: [], responsibles: [] };
}

export async function writeProjectData(state: ProjectDatabaseState): Promise<void> {
  if (isKvAvailable()) {
    try {
      await kv.set('projects_db', state);
      return;
    } catch (e) {
      console.error('Erro ao salvar dados de projetos no Vercel KV, salvando localmente:', e);
    }
  }

  // Salvar Local
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCAL_PROJECTS_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

// 3. MIGRACAO E INICIALIZAÇÃO INICIAL (SEMENTE)
export async function seedDatabaseIfEmpty(): Promise<void> {
  const users = await readUsers();
  
  if (users.length === 0) {
    console.log('Banco de dados de usuários vazio. Criando usuários administrativos padrão...');
    
    // Senhas padrão
    const developerPasswordHash = await bcrypt.hash('Guru$2026', 10);
    const diretoriaPasswordHash = await bcrypt.hash('Longview$2026', 10);

    const defaultUsers: DbUser[] = [
      {
        id: 'usr-dev',
        name: 'Carlos Santos (Desenvolvedor)',
        email: 'carlos@longview.com.br',
        passwordHash: developerPasswordHash,
        role: 'Desenvolvedor',
        permissions: {
          viewMarketingDashboard: true,
          viewMarketingLeads: true,
          viewMarketingOportunidades: true,
          viewMarketingEstoque: true,
          viewMarketingAds: true,
          viewMarketingVendas: true,
          viewProjectVision: true,
          manageProjects: true,
          manageCommentsDocs: true,
          deleteTasks: true,
          isAdmin: true
        },
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-admin',
        name: 'Diretoria Executiva',
        email: 'diretoria@longview.com.br',
        passwordHash: diretoriaPasswordHash,
        role: 'Diretoria',
        permissions: {
          viewMarketingDashboard: true,
          viewMarketingLeads: true,
          viewMarketingOportunidades: true,
          viewMarketingEstoque: true,
          viewMarketingAds: true,
          viewMarketingVendas: true,
          viewProjectVision: true,
          manageProjects: true,
          manageCommentsDocs: true,
          deleteTasks: true,
          isAdmin: true // Também é administrador, permitindo criar novos usuários
        },
        createdAt: new Date().toISOString()
      }
    ];

    await writeUsers(defaultUsers);
    console.log('Usuários iniciais semeados com sucesso!');
  }

  // Garantir inicialização dos projetos
  const projectData = await readProjectData();
  if (projectData.tasks.length === 0 && projectData.projects.length === 0) {
    console.log('Banco de dados de tarefas vazio. Tentando importar dados...');
    
    // Tenta carregar do db.ts legado que tem lógica de importação de CSV
    const legacyDbFile = path.join(DATA_DIR, 'db.json');
    if (!fs.existsSync(legacyDbFile)) {
      // Se nem o db.json existe, vamos ler do original importando do CSV
      try {
        const { readDatabase } = require('./db');
        const legacyState = readDatabase();
        const state: ProjectDatabaseState = {
          tasks: legacyState.tasks || [],
          projects: legacyState.projects || [],
          responsibles: legacyState.responsibles || []
        };
        await writeProjectData(state);
        console.log('Importado do CSV legado com sucesso!');
      } catch (e) {
        console.error('Falha ao rodar o importador legado:', e);
      }
    }
  }
}
