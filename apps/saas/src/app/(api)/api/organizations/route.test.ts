import { DuplicateError, UnauthorizedError } from '@nuclom/lib/effect/errors';
import { Auth, type AuthServiceInterface } from '@nuclom/lib/effect/services/auth';
import { BillingRepository, type BillingRepositoryService } from '@nuclom/lib/effect/services/billing-repository';
import {
  OrganizationRepository,
  type OrganizationRepositoryService,
} from '@nuclom/lib/effect/services/organization-repository';
import { SlackMonitoring, type SlackMonitoringServiceInterface } from '@nuclom/lib/effect/services/slack-monitoring';
import { Effect, Layer } from 'effect';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockOrganization, createMockSession } from '@/test/mocks';

// Mock the api-handler module to provide test layers
const mockCreateFullLayer = vi.hoisted(() => vi.fn());
vi.mock('@nuclom/lib/api-handler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuclom/lib/api-handler')>();
  const { Effect } = await import('effect');
  return {
    ...actual,
    createFullLayer: mockCreateFullLayer,
    runApiEffect: async <T, E>(effect: Effect.Effect<T, E, unknown>) => {
      const layer = mockCreateFullLayer();
      const runnable = Effect.provide(effect, layer) as Effect.Effect<T, E, never>;
      return Effect.runPromiseExit(runnable);
    },
  };
});

import { GET, POST } from './route';

describe('Organizations API Route', () => {
  // Helper to create a mock auth service
  const createMockAuthService = (authenticated = true): AuthServiceInterface => {
    const session = createMockSession();
    return {
      getSession: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: 'Unauthorized' })),
        ),
      getSessionOption: vi
        .fn()
        .mockImplementation(() =>
          authenticated
            ? Effect.succeed({ _tag: 'Some' as const, value: session })
            : Effect.succeed({ _tag: 'None' as const }),
        ),
      requireAuth: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: 'Unauthorized' })),
        ),
      requireRole: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: 'Unauthorized' })),
        ),
      requireAdmin: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: 'Unauthorized' })),
        ),
    };
  };

  // Helper to create a mock organization repository
  const createMockOrganizationRepository = (): OrganizationRepositoryService => {
    const mockOrg = createMockOrganization();
    const orgWithRole = { ...mockOrg, role: 'owner' as const };

    return {
      createOrganization: vi.fn().mockImplementation((data) => Effect.succeed({ ...mockOrg, ...data })),
      updateOrganization: vi.fn().mockImplementation((id, data) => Effect.succeed({ ...mockOrg, id, ...data })),
      getUserOrganizations: vi.fn().mockImplementation(() => Effect.succeed([orgWithRole])),
      getActiveOrganization: vi
        .fn()
        .mockImplementation(() => Effect.succeed({ _tag: 'Some' as const, value: orgWithRole })),
      getOrganization: vi.fn().mockImplementation(() => Effect.succeed(mockOrg)),
      getOrganizationBySlug: vi.fn().mockImplementation(() => Effect.succeed(mockOrg)),
      isMember: vi.fn().mockImplementation(() => Effect.succeed(true)),
      getUserRole: vi.fn().mockImplementation(() => Effect.succeed({ _tag: 'Some' as const, value: 'owner' })),
      getOrganizationMembers: vi.fn().mockImplementation(() => Effect.succeed([])),
      removeMember: vi.fn().mockImplementation(() => Effect.void),
      updateMemberRole: vi.fn().mockImplementation(() => Effect.succeed({})),
    };
  };

  // Helper to create a mock Slack monitoring service
  const createMockSlackMonitoringService = (): SlackMonitoringServiceInterface => ({
    isConfigured: false,
    sendEvent: vi.fn().mockImplementation(() => Effect.void),
    sendAccountEvent: vi.fn().mockImplementation(() => Effect.void),
    sendBillingEvent: vi.fn().mockImplementation(() => Effect.void),
    sendVideoEvent: vi.fn().mockImplementation(() => Effect.void),
    sendErrorEvent: vi.fn().mockImplementation(() => Effect.void),
  });

  // Helper to create a mock billing repository
  const createMockBillingRepository = (): Partial<BillingRepositoryService> => ({
    createTrialSubscription: vi.fn().mockImplementation(() =>
      Effect.succeed({
        id: 'sub-123',
        plan: 'scale',
        referenceId: 'org-123',
        status: 'trialing',
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      }),
    ),
  });

  // Setup test layer for each test
  const setupTestLayer = (
    options: {
      authenticated?: boolean;
      orgRepo?: Partial<OrganizationRepositoryService>;
      slackMonitoring?: Partial<SlackMonitoringServiceInterface>;
      billingRepo?: Partial<BillingRepositoryService>;
    } = {},
  ) => {
    const { authenticated = true, orgRepo = {}, slackMonitoring = {}, billingRepo = {} } = options;
    const mockAuth = createMockAuthService(authenticated);
    const mockOrgRepo = { ...createMockOrganizationRepository(), ...orgRepo };
    const mockSlack = { ...createMockSlackMonitoringService(), ...slackMonitoring };
    const mockBilling = { ...createMockBillingRepository(), ...billingRepo };

    const AuthLayer = Layer.succeed(Auth, mockAuth);
    const OrgRepoLayer = Layer.succeed(OrganizationRepository, mockOrgRepo as OrganizationRepositoryService);
    const SlackLayer = Layer.succeed(SlackMonitoring, mockSlack as SlackMonitoringServiceInterface);
    const BillingLayer = Layer.succeed(BillingRepository, mockBilling as BillingRepositoryService);
    const testLayer = Layer.mergeAll(AuthLayer, OrgRepoLayer, SlackLayer, BillingLayer);

    mockCreateFullLayer.mockReturnValue(testLayer as never);

    return { mockAuth, mockOrgRepo, mockSlack, mockBilling };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/organizations', () => {
    it('should return 401 when user is not authenticated', async () => {
      setupTestLayer({ authenticated: false });

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('AUTH_UNAUTHORIZED');
      expect(data.error.message).toBe('Unauthorized');
    });

    it('should return user organizations on success', async () => {
      const { mockOrgRepo } = setupTestLayer();

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].role).toBe('owner');
      expect(mockOrgRepo.getUserOrganizations).toHaveBeenCalled();
    });

    it('should return empty array when user has no organizations', async () => {
      setupTestLayer({
        orgRepo: {
          getUserOrganizations: vi.fn().mockImplementation(() => Effect.succeed([])),
        },
      });

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe('POST /api/organizations', () => {
    it('should return 400 when name is missing', async () => {
      setupTestLayer();

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test-org',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 400 when slug is missing', async () => {
      setupTestLayer();

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Organization',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 401 when user is not authenticated', async () => {
      setupTestLayer({ authenticated: false });

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Organization',
          slug: 'test-org',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('AUTH_UNAUTHORIZED');
      expect(data.error.message).toBe('Unauthorized');
    });

    it('should return 409 when slug already exists', async () => {
      setupTestLayer({
        orgRepo: {
          createOrganization: vi.fn().mockImplementation(() =>
            Effect.fail(
              new DuplicateError({
                message: 'Organization with this slug already exists',
                entity: 'organization',
              }),
            ),
          ),
        },
      });

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Organization',
          slug: 'existing-slug',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.code).toBe('CONFLICT_DUPLICATE');
      expect(data.error.message).toBe('Organization with this slug already exists');
    });

    it('should create organization and return 201 on success', async () => {
      const { mockOrgRepo, mockSlack } = setupTestLayer();

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Organization',
          slug: 'test-org',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('org-123');
      expect(data.name).toBe('Test Organization');
      expect(mockOrgRepo.createOrganization).toHaveBeenCalled();
      expect(mockSlack.sendAccountEvent).toHaveBeenCalledWith('organization_created', expect.any(Object));
    });

    it('should create organization with logo', async () => {
      setupTestLayer({
        orgRepo: {
          createOrganization: vi
            .fn()
            .mockImplementation((data) => Effect.succeed({ ...createMockOrganization(), ...data })),
        },
      });

      const request = new NextRequest('http://localhost:5001/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Organization',
          slug: 'test-org',
          logo: '/custom-logo.png',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.logo).toBe('/custom-logo.png');
    });
  });
});
