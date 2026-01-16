/**
 * Brand constants for Nuclom
 * Used across OG images, brand page, and other brand-related components
 */

export const brand = {
  name: 'Nuclom',
  tagline: 'Video Collaboration Platform',
  description: 'Real-time collaboration, AI-powered transcription, and seamless sharing',

  colors: {
    // Brand gradient
    gradientStart: '#7c3aed',
    gradientEnd: '#9333ea',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',

    // Primary colors
    primary: {
      light: '#6633ff',
      dark: '#7c66ff',
    },

    // Background colors
    background: {
      light: '#ffffff',
      dark: '#0d0f17',
      darkSecondary: '#1a1d2e',
    },

    // Foreground colors
    foreground: {
      light: '#0f172a',
      dark: '#f8fafc',
    },

    // Semantic colors
    success: '#22c55e',
    warning: '#f59e0b',
    destructive: '#ef4444',
    muted: '#64748b',
  },

  // Tailwind class helpers
  tailwind: {
    gradient: 'bg-gradient-to-br from-[#7c3aed] to-[#9333ea]',
    darkBackground: 'bg-[#0d0f17]',
  },
} as const;

export type Brand = typeof brand;
