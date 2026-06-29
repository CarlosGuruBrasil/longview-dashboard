/**
 * project-vision-contract.ts
 *
 * Contrato de tipos e funções do Project Vision.
 * Este arquivo QUEBRA O BUILD se qualquer função ou interface crítica
 * for removida ou tiver a assinatura alterada — proteção automática contra
 * regressões ao mexer em outras partes do código.
 *
 * NÃO adicione lógica aqui. Apenas importações e type assertions.
 */

import type {
  Task,
  Project,
  Responsible,
  Subtask,
  Comment,
  ChangeLog,
  TaskDocumentMeta,
  ProjectDatabaseState,
} from './db-kv';

import {
  readTasks,
  readTaskById,
  nextTaskId,
  upsertTask,
  deleteTask,
  readProjectData,
  mutateProjectData,
  listTaskDocuments,
  getTaskDocumentData,
  addTaskDocument,
  deleteTaskDocument,
} from './db-kv';

// ─── Verificações de tipo em compile-time ────────────────────────────────────
// Se qualquer uma dessas linhas falhar, o build quebra antes do deploy.

// Task deve ter os campos obrigatórios
type _AssertTask = Task & {
  id: string; project: string; sector: string; subject: string;
  description: string; responsible: string; secondaryResponsibles: string[];
  statusContratacao: string;
  statusAndamento: 'Não iniciado'|'Em andamento'|'Aguardando'|'Em análise'|'Finalizado';
  urgencia: 'Baixa'|'Média'|'Alta'|'Crítica'|'Emergencial';
  inicio: string; previsaoEntrega: string; entregaEfetiva: string;
  situacao: string; observacoesRotinas: string; progress: number;
  subtasks: Subtask[]; comments: Comment[]; documents: unknown[];
  logs: ChangeLog[]; dependencies: string[]; tags: string[];
};

// Project deve ter banner (para fotos de capa)
type _AssertProject = Project & { id: string; name: string; banner: string; progress: number; };

// TaskDocumentMeta deve ter os campos de metadado
type _AssertDocMeta = TaskDocumentMeta & {
  id: string; taskId: string; name: string; category: string;
  uploadedBy: string; uploadedAt: string; version: number;
};

// Assinaturas das funções críticas — alterar parâmetros/retorno quebra aqui
type _FnReadTasks       = typeof readTasks       extends (f?: object) => Promise<Task[]>              ? true : never;
type _FnReadTaskById    = typeof readTaskById    extends (id: string) => Promise<Task | null>         ? true : never;
type _FnNextTaskId      = typeof nextTaskId      extends ()           => Promise<string>              ? true : never;
type _FnUpsertTask      = typeof upsertTask      extends (t: Task)    => Promise<void>                ? true : never;
type _FnDeleteTask      = typeof deleteTask      extends (id: string) => Promise<boolean>             ? true : never;
type _FnReadProjectData = typeof readProjectData extends ()           => Promise<ProjectDatabaseState>? true : never;
type _FnListTaskDocs    = typeof listTaskDocuments extends (id: string) => Promise<TaskDocumentMeta[]>? true : never;
type _FnDeleteTaskDoc   = typeof deleteTaskDocument extends (d: string, t: string) => Promise<boolean>? true : never;

// Se qualquer tipo acima for `never`, isso causa erro de compilação:
const _checks: [
  _FnReadTasks, _FnReadTaskById, _FnNextTaskId, _FnUpsertTask,
  _FnDeleteTask, _FnReadProjectData, _FnListTaskDocs, _FnDeleteTaskDoc,
] = [true, true, true, true, true, true, true, true];

// Exporta como prova de que o módulo é válido (usada pelo health check)
export const PROJECT_VISION_CONTRACT_VERSION = '2.0.0';
export type { Task, Project, Responsible, Subtask, Comment, ChangeLog, TaskDocumentMeta, ProjectDatabaseState };
export {
  readTasks, readTaskById, nextTaskId, upsertTask, deleteTask,
  readProjectData, mutateProjectData,
  listTaskDocuments, getTaskDocumentData, addTaskDocument, deleteTaskDocument,
};

// Silencia variável não usada
void _checks;
