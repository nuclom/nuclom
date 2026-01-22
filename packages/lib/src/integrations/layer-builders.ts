/**
 * Effect Layer Builders
 *
 * Provides factory functions for composing common Effect-TS layers,
 * eliminating duplication across API routes and services.
 */

import { Layer } from 'effect';
import { DatabaseLive } from '../effect/services/database';
import { GoogleClientLive } from '../effect/services/google-client';
// Import integration service layers
import { GoogleMeetLive } from '../effect/services/google-meet';
import { IntegrationRepositoryLive } from '../effect/services/integration-repository';
import { MicrosoftTeamsLive } from '../effect/services/microsoft-teams';
import { MicrosoftTeamsClientLive } from '../effect/services/microsoft-teams-client';
import { SlackLive } from '../effect/services/slack';
import { SlackClientLive } from '../effect/services/slack-client';
import { ZoomLive } from '../effect/services/zoom';
import { ZoomClientLive } from '../effect/services/zoom-client';

// =============================================================================
// Base Layer Compositions
// =============================================================================

/**
 * Integration repository with database dependency resolved
 */
export const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));

const GoogleMeetWithDeps = GoogleMeetLive.pipe(Layer.provide(GoogleClientLive));
const SlackLiveWithDeps = SlackLive.pipe(Layer.provide(SlackClientLive));
const ZoomLiveWithDeps = ZoomLive.pipe(Layer.provide(ZoomClientLive));
const TeamsLiveWithDeps = MicrosoftTeamsLive.pipe(Layer.provide(MicrosoftTeamsClientLive));

// =============================================================================
// Provider-Specific Layers
// =============================================================================

/**
 * Layer for Google OAuth callbacks and API calls
 */
export const GoogleIntegrationLayer = Layer.mergeAll(GoogleMeetWithDeps, IntegrationRepositoryWithDeps, DatabaseLive);

/**
 * Layer for Slack OAuth callbacks and API calls
 */
export const SlackIntegrationLayer = Layer.mergeAll(SlackLiveWithDeps, IntegrationRepositoryWithDeps, DatabaseLive);

/**
 * Layer for Zoom OAuth callbacks and API calls
 */
export const ZoomIntegrationLayer = Layer.mergeAll(ZoomLiveWithDeps, IntegrationRepositoryWithDeps, DatabaseLive);

/**
 * Layer for Microsoft Teams OAuth callbacks and API calls
 */
export const TeamsIntegrationLayer = Layer.mergeAll(TeamsLiveWithDeps, IntegrationRepositoryWithDeps, DatabaseLive);

// =============================================================================
// Layer Lookup by Provider
// =============================================================================

export type IntegrationProvider = 'google' | 'slack' | 'zoom' | 'teams';

const providerLayers = {
  google: GoogleIntegrationLayer,
  slack: SlackIntegrationLayer,
  zoom: ZoomIntegrationLayer,
  teams: TeamsIntegrationLayer,
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
