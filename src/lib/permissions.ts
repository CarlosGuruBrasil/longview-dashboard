export interface UserPermissions {
  viewMarketingDashboard: boolean;
  viewMarketingLeads: boolean;
  viewMarketingOportunidades: boolean;
  viewMarketingEstoque: boolean;
  viewMarketingAds: boolean;
  viewMarketingVendas: boolean;
  viewProjectVision: boolean;
  manageProjects: boolean;
  manageCommentsDocs: boolean;
  deleteTasks: boolean;
  viewRHVision?: boolean;
  viewQualityVision?: boolean;
  isAdmin: boolean;
}

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
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
  viewRHVision: false,
  viewQualityVision: false,
  isAdmin: false,
};

export function createDefaultPermissions(overrides: Partial<UserPermissions> = {}): UserPermissions {
  return { ...DEFAULT_USER_PERMISSIONS, ...overrides };
}

export function normalizePermissions(permissions?: Partial<UserPermissions> | null): UserPermissions {
  return createDefaultPermissions(permissions ?? {});
}
