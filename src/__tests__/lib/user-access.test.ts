import { describe, it, expect } from 'vitest';
import { canManageUserPermissions, canSetManagerId, isDirectReport } from '@/lib/user-access';
import type { DbUser } from '@/lib/db-kv';

function makeUser(overrides: Partial<DbUser>): DbUser {
  return {
    id: 'usr-x', name: 'Test', email: 'x@longview.com.br', passwordHash: '',
    role: 'Operador', permissions: {} as never, createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const dev = makeUser({ id: 'usr-dev', role: 'Desenvolvedor' });
const diretor = makeUser({ id: 'usr-dir', role: 'Diretoria' });
const gestor = makeUser({ id: 'usr-gestor', role: 'Gestor' });
const outroGestor = makeUser({ id: 'usr-gestor-2', role: 'Gestor' });
const reportDireto = makeUser({ id: 'usr-report', role: 'Operador', profile: { managerId: 'usr-gestor' } });
const naoReport = makeUser({ id: 'usr-outro', role: 'Operador', profile: { managerId: 'usr-gestor-2' } });
const semManager = makeUser({ id: 'usr-sem-manager', role: 'Operador' });

describe('isDirectReport', () => {
  it('true quando managerId do target aponta pro viewer', () => {
    expect(isDirectReport(gestor, reportDireto)).toBe(true);
  });
  it('false quando managerId aponta pra outro gestor', () => {
    expect(isDirectReport(gestor, naoReport)).toBe(false);
  });
  it('false quando managerId não está definido', () => {
    expect(isDirectReport(gestor, semManager)).toBe(false);
  });
});

describe('canManageUserPermissions — escopo de equipe do Gestor', () => {
  it('Gestor pode gerenciar permissões de quem reporta direto a ele', () => {
    expect(canManageUserPermissions(gestor, reportDireto)).toBe(true);
  });
  it('Gestor NÃO pode gerenciar permissões de colaborador de outra equipe', () => {
    expect(canManageUserPermissions(gestor, naoReport)).toBe(false);
  });
  it('Gestor NÃO pode gerenciar quem não tem managerId definido, mesmo sendo colaborador comum', () => {
    expect(canManageUserPermissions(gestor, semManager)).toBe(false);
  });
  it('Diretoria pode gerenciar qualquer colaborador de rank menor, sem escopo de equipe', () => {
    expect(canManageUserPermissions(diretor, naoReport)).toBe(true);
    expect(canManageUserPermissions(diretor, semManager)).toBe(true);
  });
  it('Desenvolvedor pode gerenciar qualquer colaborador, sem escopo de equipe (regressão: faltava esse branch)', () => {
    expect(canManageUserPermissions(dev, naoReport)).toBe(true);
    expect(canManageUserPermissions(dev, semManager)).toBe(true);
    expect(canManageUserPermissions(dev, gestor)).toBe(true);
  });
  it('Desenvolvedor NÃO pode gerenciar permissões de outro Desenvolvedor', () => {
    expect(canManageUserPermissions(dev, makeUser({ id: 'usr-dev-2', role: 'Desenvolvedor' }))).toBe(false);
  });
});

describe('canSetManagerId', () => {
  it('Diretoria pode definir managerId', () => {
    expect(canSetManagerId(diretor)).toBe(true);
  });
  it('Desenvolvedor pode definir managerId', () => {
    expect(canSetManagerId(makeUser({ role: 'Desenvolvedor' }))).toBe(true);
  });
  it('isAdmin=true pode definir managerId', () => {
    expect(canSetManagerId(makeUser({ role: 'Operador', permissions: { isAdmin: true } as never }))).toBe(true);
  });
  it('Gestor NÃO pode definir managerId — senão se auto-atribuiria liderados', () => {
    expect(canSetManagerId(gestor)).toBe(false);
  });
});
