import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

const { cookies } = await import('next/headers');
const { verifyAuth, verifyAdminAuth, verifyPermission } = await import('@/lib/auth');

const mockCookieStore = { get: vi.fn() };

const baseUser = {
  userId: '1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'Operador',
  permissions: { viewMarketingDashboard: true, isAdmin: false },
};

const adminUser = {
  ...baseUser,
  role: 'Desenvolvedor',
  permissions: {},
};

const adminViaPermission = {
  ...baseUser,
  permissions: { viewMarketingDashboard: false, isAdmin: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  (cookies as ReturnType<typeof vi.fn>).mockResolvedValue(mockCookieStore);
});

describe('verifyAuth', () => {
  it('returns decoded user when valid token is present', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
    vi.spyOn(jwt, 'verify').mockReturnValue(baseUser as never);

    const result = await verifyAuth();
    expect(result).toEqual(baseUser);
  });

  it('returns null when no auth_token cookie exists', async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await verifyAuth();
    expect(result).toBeNull();
  });

  it('returns null when token verification throws', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'bad-token' });
    vi.spyOn(jwt, 'verify').mockImplementation(() => { throw new Error('jwt malformed'); });

    const result = await verifyAuth();
    expect(result).toBeNull();
  });
});

describe('verifyAdminAuth', () => {
  it('returns user for Desenvolvedor role', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token' });
    vi.spyOn(jwt, 'verify').mockReturnValue(adminUser as never);

    const result = await verifyAdminAuth();
    expect(result).toEqual(adminUser);
  });

  it('returns user when isAdmin permission is true', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token' });
    vi.spyOn(jwt, 'verify').mockReturnValue(adminViaPermission as never);

    const result = await verifyAdminAuth();
    expect(result).toEqual(adminViaPermission);
  });

  it('returns null for non-admin user', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token' });
    vi.spyOn(jwt, 'verify').mockReturnValue(baseUser as never);

    const result = await verifyAdminAuth();
    expect(result).toBeNull();
  });

  it('returns null when not authenticated', async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await verifyAdminAuth();
    expect(result).toBeNull();
  });
});

describe('verifyPermission', () => {
  it('returns user for Desenvolvedor regardless of permission', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token' });
    vi.spyOn(jwt, 'verify').mockReturnValue(adminUser as never);

    const result = await verifyPermission('nonexistent');
    expect(result).toEqual(adminUser);
  });

  it('returns user when specific permission is granted', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token' });
    vi.spyOn(jwt, 'verify').mockReturnValue(baseUser as never);

    const result = await verifyPermission('viewMarketingDashboard');
    expect(result).toEqual(baseUser);
  });

  it('returns null when permission is not granted', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'token' });
    vi.spyOn(jwt, 'verify').mockReturnValue(baseUser as never);

    const result = await verifyPermission('viewSalesVision');
    expect(result).toBeNull();
  });

  it('returns null when not authenticated', async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const result = await verifyPermission('any');
    expect(result).toBeNull();
  });
});
