import type { DbUser, UserProfileData } from '@/lib/db-kv';

export type UserCategory = 'colaborador' | 'fornecedor';

type SafeUserRecord = Omit<DbUser, 'passwordHash'>;

function normalizeText(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function getUserCategory(user?: Pick<DbUser, 'role' | 'profile'> | null): UserCategory {
  const explicit = user?.profile?.category;
  if (explicit === 'fornecedor' || explicit === 'colaborador') return explicit;
  return user?.role === 'Parceiro' ? 'fornecedor' : 'colaborador';
}

export function isManagerialPosition(position?: string | null): boolean {
  const value = normalizeText(position);
  return value.includes('gerent') || value.includes('coorden') || value.includes('supervisor') || value.includes('gestor');
}

export function isFinanceDepartment(profile?: UserProfileData | null): boolean {
  return normalizeText(profile?.department).includes('finance');
}

export function isHRDepartment(profile?: UserProfileData | null): boolean {
  const value = normalizeText(profile?.department);
  return value.includes('rh') || value.includes('recursos humanos') || value.includes('people');
}

export function canManageAllPeople(viewer?: DbUser | null): boolean {
  if (!viewer) return false;
  if (viewer.role === 'Desenvolvedor' || viewer.role === 'Diretoria' || viewer.permissions?.isAdmin === true) {
    return true;
  }
  if (getUserCategory(viewer) === 'fornecedor') return false;
  if (isFinanceDepartment(viewer.profile)) return false;
  return isManagerialPosition(viewer.profile?.position);
}

function getManagementRank(user?: DbUser | null): number {
  if (!user) return 0;
  if (user.role === 'Desenvolvedor') return 5;
  if (user.role === 'Diretoria') return 4;
  if (canManageAllPeople(user)) return 3;
  if (getUserCategory(user) === 'fornecedor') return 1;
  return 2;
}

export function canViewAllPeopleReadOnly(viewer?: DbUser | null): boolean {
  if (!viewer) return false;
  if (canManageAllPeople(viewer)) return true;
  return getUserCategory(viewer) === 'colaborador' && isFinanceDepartment(viewer.profile);
}

export function canSeeSuppliers(viewer?: DbUser | null): boolean {
  if (!viewer) return false;
  if (getUserCategory(viewer) === 'fornecedor') return false;
  return canManageAllPeople(viewer) || canViewAllPeopleReadOnly(viewer);
}

export function canSeeUserInDirectory(viewer: DbUser, target: DbUser): boolean {
  if (viewer.id === target.id) return true;
  if (getUserCategory(viewer) === 'fornecedor') return false;
  if (getUserCategory(target) === 'fornecedor') return canSeeSuppliers(viewer);
  return true;
}

export function canViewFullPeopleProfile(viewer: DbUser, target: DbUser): boolean {
  if (viewer.id === target.id) return true;
  if (canManageAllPeople(viewer) || canViewAllPeopleReadOnly(viewer)) {
    return getUserCategory(target) === 'colaborador' || canSeeSuppliers(viewer);
  }
  return false;
}

export function canEditTargetUser(viewer: DbUser, target: DbUser): boolean {
  if (viewer.id === target.id) return true;
  if (canViewAllPeopleReadOnly(viewer) && !canManageAllPeople(viewer)) return false;
  if (getUserCategory(viewer) === 'fornecedor') return false;
  if (getUserCategory(target) === 'fornecedor' && !canSeeSuppliers(viewer)) return false;
  return canManageAllPeople(viewer);
}

export function canManageUserPermissions(viewer: DbUser, target: DbUser): boolean {
  if (viewer.id === target.id) return false;
  if (!canManageAllPeople(viewer)) return false;
  if (target.role === 'Desenvolvedor') return false;

  const viewerRank = getManagementRank(viewer);
  const targetRank = getManagementRank(target);

  if (viewer.role === 'Diretoria') {
    return targetRank < viewerRank;
  }

  if (viewer.role === 'Gestor' || isManagerialPosition(viewer.profile?.position)) {
    return targetRank < viewerRank && target.role !== 'Diretoria' && !isManagerialPosition(target.profile?.position);
  }

  return false;
}

export function canAccessHrMetrics(user?: Pick<DbUser, 'role' | 'profile'> | null): boolean {
  if (!user) return false;
  return user.role === 'Diretoria' || user.role === 'Desenvolvedor' || isHRDepartment(user.profile);
}

export function sanitizeUserForDirectory(viewer: DbUser, target: DbUser): SafeUserRecord {
  const { passwordHash: _passwordHash, ...safe } = target;
  const fullAccess = canViewFullPeopleProfile(viewer, target);
  if (fullAccess) return safe;

  return {
    ...safe,
    profile: {
      category: getUserCategory(target),
      department: safe.profile?.department,
      position: safe.profile?.position,
      company: safe.profile?.company,
      status: safe.profile?.status,
      phone: safe.profile?.phone,
      whatsapp: safe.profile?.whatsapp,
      avatarUrl: safe.profile?.avatarUrl,
    },
  };
}

export function sanitizeUserForDetail(viewer: DbUser, target: DbUser): SafeUserRecord {
  const { passwordHash: _passwordHash, ...safe } = target;
  if (canViewFullPeopleProfile(viewer, target)) return safe;

  return {
    ...safe,
    profile: {
      category: getUserCategory(target),
      department: safe.profile?.department,
      position: safe.profile?.position,
      company: safe.profile?.company,
      status: safe.profile?.status,
      phone: safe.profile?.phone,
      whatsapp: safe.profile?.whatsapp,
      avatarUrl: safe.profile?.avatarUrl,
      linkedIn: safe.profile?.linkedIn,
    },
  };
}
