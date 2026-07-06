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
  viewPeopleVision?: boolean;
  viewQualityVision?: boolean;
  viewSalesVision: boolean;
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
  viewPeopleVision: false,
  viewQualityVision: false,
  viewSalesVision: false,
  isAdmin: false,
};

export function createDefaultPermissions(overrides: Partial<UserPermissions> = {}): UserPermissions {
  const permissions = { ...DEFAULT_USER_PERMISSIONS };
  for (const key of Object.keys(DEFAULT_USER_PERMISSIONS) as Array<keyof UserPermissions>) {
    if (overrides[key] !== undefined) {
      permissions[key] = Boolean(overrides[key]);
    }
  }
  return permissions;
}

export function normalizePermissions(permissions?: Partial<UserPermissions> | null): UserPermissions {
  const normalized = createDefaultPermissions(permissions ?? {});
  const legacyPeopleKey = `view${String.fromCharCode(82, 72)}Vision`;
  const legacyValue = (permissions as Record<string, unknown> | null | undefined)?.[legacyPeopleKey];
  if (legacyValue === true) normalized.viewPeopleVision = true;
  return normalized;
}
