/**
 * @nuclom/auth - Shared authentication package
 *
 * This package provides shared authentication configuration that works
 * across both the marketing and saas apps with shared session cookies.
 */

// Re-export access control
export {
  ac,
  organizationRoles,
  ownerRole,
  adminRole,
  editorRole,
  memberRole,
  permissionStatement,
  type PermissionResource,
  type PermissionAction,
} from './access-control';

// Cookie configuration for cross-app session sharing
export const AUTH_COOKIE_CONFIG = {
  // Cookie prefix used by better-auth
  prefix: 'nuclom',

  // Domain for cross-app cookie sharing
  // In production, this allows both nuclom.com and *.nuclom.com to share sessions
  getCookieDomain: (isProduction: boolean): string | undefined => {
    if (isProduction) {
      return '.nuclom.com'; // Leading dot allows subdomains to share
    }
    return undefined; // localhost doesn't need domain
  },

  // Whether to use secure cookies (HTTPS only)
  isSecure: (url: string): boolean => {
    return url.startsWith('https://');
  },
} as const;

// Production URL helper
export function getProductionURL(vercelTargetEnv?: string): string {
  if (vercelTargetEnv === 'production') {
    return 'https://nuclom.com';
  }
  return 'https://staging.nuclom.com';
}

// Build trusted origins for CORS
export function buildTrustedOrigins(options: {
  appUrl: string;
  vercelUrl?: string;
  vercelBranchUrl?: string;
  vercelProductionUrl?: string;
  isDevelopment: boolean;
}): string[] {
  const origins: string[] = [];

  // Always trust the computed app URL
  origins.push(options.appUrl);

  // Production and staging domains
  origins.push('https://nuclom.com');
  origins.push('https://staging.nuclom.com');

  // Vercel deployment URL (for deploy previews)
  if (options.vercelUrl) {
    origins.push(`https://${options.vercelUrl}`);
  }

  // Vercel branch URL
  if (options.vercelBranchUrl) {
    origins.push(`https://${options.vercelBranchUrl}`);
  }

  // Production Vercel URL
  if (options.vercelProductionUrl) {
    origins.push(`https://${options.vercelProductionUrl}`);
  }

  // Localhost for development
  if (options.isDevelopment) {
    origins.push('http://localhost:3091');
    origins.push('http://localhost:3092'); // Marketing app port
  }

  return [...new Set(origins.filter(Boolean))];
}
