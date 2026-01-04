/**
 * Integrations Module
 *
 * Provides utilities and abstractions for OAuth integrations.
 */

// Layer builders
export {
  GitHubIntegrationLayer,
  GoogleIntegrationLayer,
  getIntegrationLayer,
  type IntegrationProvider,
  IntegrationRepositoryWithDeps,
  SlackIntegrationLayer,
  TeamsIntegrationLayer,
  ZoomIntegrationLayer,
} from "./layer-builders";
// OAuth Handler utilities
export {
  encodeOAuthState,
  errorRedirect,
  isStateExpired,
  type OAuthCallbackResult,
  type OAuthState,
  type OAuthTokens,
  parseOAuthState,
  saveIntegration,
  successRedirect,
  validateOAuthCallback,
} from "./oauth-handler";
