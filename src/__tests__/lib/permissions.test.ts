import { describe, it, expect } from 'vitest';
import { createDefaultPermissions, normalizePermissions, DEFAULT_USER_PERMISSIONS } from '@/lib/permissions';

describe('createDefaultPermissions', () => {
  it('returns all false by default', () => {
    const perms = createDefaultPermissions();
    for (const value of Object.values(perms)) {
      expect(value).toBe(false);
    }
  });

  it('overrides specified permissions', () => {
    const perms = createDefaultPermissions({ viewMarketingDashboard: true, isAdmin: true });
    expect(perms.viewMarketingDashboard).toBe(true);
    expect(perms.isAdmin).toBe(true);
    expect(perms.viewMarketingLeads).toBe(false);
  });

  it('coerces truthy values to boolean', () => {
    const perms = createDefaultPermissions({ viewMarketingDashboard: 1 as never });
    expect(perms.viewMarketingDashboard).toBe(true);
  });

  it('ignores keys not in DEFAULT_USER_PERMISSIONS', () => {
    const perms = createDefaultPermissions({ unknownKey: true } as never);
    expect((perms as unknown as Record<string, unknown>).unknownKey).toBeUndefined();
  });
});

describe('normalizePermissions', () => {
  it('returns default permissions when given null', () => {
    const perms = normalizePermissions(null);
    expect(perms).toEqual(DEFAULT_USER_PERMISSIONS);
  });

  it('returns default permissions when given undefined', () => {
    const perms = normalizePermissions();
    expect(perms).toEqual(DEFAULT_USER_PERMISSIONS);
  });

  it('applies overrides on top of defaults', () => {
    const perms = normalizePermissions({ viewMarketingDashboard: true, viewSalesVision: true });
    expect(perms.viewMarketingDashboard).toBe(true);
    expect(perms.viewSalesVision).toBe(true);
    expect(perms.viewMarketingLeads).toBe(false);
  });

  it('maps legacy viewRHVision to viewPeopleVision', () => {
    const perms = normalizePermissions({ viewRHVision: true } as any);
    expect(perms.viewPeopleVision).toBe(true);
  });

  it('does not set viewPeopleVision if legacy key is not true', () => {
    const perms = normalizePermissions({ viewRHVision: false } as any);
    expect(perms.viewPeopleVision).toBe(false);
  });
});
