/**
 * Effect Layer Builders
 *
 * Provides factory functions for composing common Effect-TS layers,
 * eliminating duplication across API routes and services.
 */

import { Layer } from 'effect';
import { DatabaseLive } from '@/lib/effect/services/database';
// Import integration service layers
import { GitHubLive } from '@/lib/effect/services/github';
import { GoogleMeetLive } from '@/lib/effect/services/google-meet';
import { IntegrationRepositoryLive } from '@/lib/effect/services/integration-repository';
import { MicrosoftTeamsLive } from '@/lib/effect/services/microsoft-teams';
import { SlackLive } from '@/lib/effect/services/slack';
import { ZoomLive } from '@/lib/effect/services/zoom';

// =============================================================================
// Base Layer Compositions
// =============================================================================

/**
 * Integration repository with database dependency resolved
 */
export const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));

// =============================================================================
// Provider-Specific Layers
// =============================================================================

/**
 * Layer for Google OAuth callbacks and API calls
 */
export const GoogleIntegrationLayer = Layer.mergeAll(GoogleMeetLive, IntegrationRepositoryWithDeps, DatabaseLive);

/**
 * Layer for Slack OAuth callbacks and API calls
 */
export const SlackIntegrationLayer = Layer.mergeAll(SlackLive, IntegrationRepositoryWithDeps, DatabaseLive);

/**
 * Layer for Zoom OAuth callbacks and API calls
 */
export const ZoomIntegrationLayer = Layer.mergeAll(ZoomLive, IntegrationRepositoryWithDeps, DatabaseLive);

/**
 * Layer for Microsoft Teams OAuth callbacks and API calls
 */
export const TeamsIntegrationLayer = Layer.mergeAll(MicrosoftTeamsLive, IntegrationRepositoryWithDeps, DatabaseLive);

/**
 * Layer for GitHub OAuth callbacks and API calls
 */
export const GitHubIntegrationLayer = Layer.mergeAll(GitHubLive, IntegrationRepositoryWithDeps, DatabaseLive);

// =============================================================================
// Layer Lookup by Provider
// =============================================================================

export type IntegrationProvider = 'google' | 'slack' | 'zoom' | 'teams' | 'github';

const providerLayers = {
  google: GoogleIntegrationLayer,
  slack: SlackIntegrationLayer,
  zoom: ZoomIntegrationLayer,
  teams: TeamsIntegrationLayer,
  github: GitHubIntegrationLayer,
} as const;

/**
 * Get the appropriate layer for a given integration provider
 */
export function getIntegrationLayer(provider: IntegrationProvider) {
  return providerLayers[provider];
}

// =============================================================================
// Export Types
// =============================================================================

export type GoogleIntegrationLayer = typeof GoogleIntegrationLayer;
export type SlackIntegrationLayer = typeof SlackIntegrationLayer;
export type ZoomIntegrationLayer = typeof ZoomIntegrationLayer;
export type TeamsIntegrationLayer = typeof TeamsIntegrationLayer;
export type GitHubIntegrationLayer = typeof GitHubIntegrationLayer;
