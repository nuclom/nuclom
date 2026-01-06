export type ChangelogEntry = {
  date: string;
  title: string;
  type: 'feature' | 'improvement' | 'fix';
};

// Product changelog - focus on user-facing features and fixes
// Update this file when completing features or bug fixes
export const changelog: ChangelogEntry[] = [
  // 2026-01-05
  {
    date: '2026-01-05',
    title: 'Render and export highlight reels as video files',
    type: 'feature',
  },
  {
    date: '2026-01-05',
    title: "See who's watching a video with real-time presence indicators",
    type: 'feature',
  },
  {
    date: '2026-01-05',
    title: 'Create shareable quote cards from video moments',
    type: 'feature',
  },
  {
    date: '2026-01-05',
    title: 'Link GitHub code references to video timestamps',
    type: 'feature',
  },
  {
    date: '2026-01-05',
    title: 'Slack integration with channel notifications',
    type: 'feature',
  },
  {
    date: '2026-01-05',
    title: 'Microsoft Teams integration for video sharing',
    type: 'feature',
  },
  {
    date: '2026-01-05',
    title: 'Zapier webhooks for workflow automation',
    type: 'feature',
  },

  // 2026-01-04
  {
    date: '2026-01-04',
    title: 'Share video moments with timestamped URLs',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'Platform available in 15 languages',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'AI insights dashboard with topic trends and action items',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'Meeting effectiveness score with participation metrics',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'Keyword cloud visualization for video content',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'Semantic search finds videos by concept, not just keywords',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'Find similar videos based on content analysis',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'SSO/SAML for enterprise authentication',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'Custom roles and permissions management',
    type: 'feature',
  },
  {
    date: '2026-01-04',
    title: 'Audit logs with filtering and CSV export',
    type: 'feature',
  },

  // 2026-01-02
  {
    date: '2026-01-02',
    title: 'Auto-detect key moments: decisions, action items, Q&A, demos',
    type: 'feature',
  },
  {
    date: '2026-01-02',
    title: 'Create clips from detected video moments',
    type: 'feature',
  },
  {
    date: '2026-01-02',
    title: 'Knowledge graph connects related videos and decisions',
    type: 'feature',
  },
  {
    date: '2026-01-02',
    title: 'Searchable decision registry',
    type: 'feature',
  },
  {
    date: '2026-01-02',
    title: 'Automatic speaker identification in transcripts',
    type: 'feature',
  },
  {
    date: '2026-01-02',
    title: 'Talk time distribution and participation balance',
    type: 'feature',
  },

  // 2026-01-01
  {
    date: '2026-01-01',
    title: 'Browse and import videos from Google Drive',
    type: 'feature',
  },
  {
    date: '2026-01-01',
    title: 'Bulk upload up to 20 files at once (up to 5GB each)',
    type: 'feature',
  },
  {
    date: '2026-01-01',
    title: 'Organization-wide activity feed',
    type: 'feature',
  },

  // 2025-12-31
  {
    date: '2025-12-31',
    title: 'Video analytics dashboard with view tracking',
    type: 'feature',
  },
  {
    date: '2025-12-31',
    title: '@mentions in comments with autocomplete',
    type: 'feature',
  },
  {
    date: '2025-12-31',
    title: 'Comment reactions: like, love, laugh, surprised, sad, celebrate',
    type: 'feature',
  },
  {
    date: '2025-12-31',
    title: 'Share videos with password protection and expiration',
    type: 'feature',
  },
  {
    date: '2025-12-31',
    title: 'Trash and restore deleted videos',
    type: 'feature',
  },

  // 2025-12-30
  {
    date: '2025-12-30',
    title: 'Multi-language subtitles with 26 supported languages',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Interactive transcript with click-to-seek',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Edit and adjust transcript timestamps',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Search within video transcripts',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Email notifications for comments, invitations, and billing',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Notification bell with unread count',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Full-text search across all videos',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Series for organizing videos into learning paths',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Drag-and-drop video reordering in series',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Track watch progress across series',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Import recordings from Zoom and Google Meet',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Stripe billing with subscription management',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Video player with keyboard shortcuts',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Playback speed control (0.5x to 2x)',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Auto-save video watch progress',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Threaded comment replies with real-time updates',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Timestamped comments linked to video moments',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'AI-powered video transcription and summarization',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Automatic chapter generation from video content',
    type: 'feature',
  },
  {
    date: '2025-12-30',
    title: 'Email verification for new accounts',
    type: 'feature',
  },

  // 2025-07-05
  {
    date: '2025-07-05',
    title: 'Organization workspaces for team collaboration',
    type: 'feature',
  },

  // 2025-07-04
  {
    date: '2025-07-04',
    title: 'Video upload with cloud storage',
    type: 'feature',
  },
  {
    date: '2025-07-04',
    title: 'User authentication with GitHub and Google login',
    type: 'feature',
  },
];
