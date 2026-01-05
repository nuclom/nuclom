export type ChangelogEntry = {
  date: string;
  title: string;
  type: "feature" | "improvement" | "fix";
};

// Product changelog - focus on user-facing features and fixes
// Update this file when completing features or bug fixes
export const changelog: ChangelogEntry[] = [
  // 2026-01-05
  {
    date: "2026-01-05",
    title: "Highlight reels can now be rendered and exported as video files",
    type: "feature",
  },
  {
    date: "2026-01-05",
    title: "Real-time presence indicators show who's watching a video",
    type: "feature",
  },
  {
    date: "2026-01-05",
    title: "Create shareable quote cards from video moments",
    type: "feature",
  },
  {
    date: "2026-01-05",
    title: "Link GitHub code references to specific video timestamps",
    type: "feature",
  },
  {
    date: "2026-01-05",
    title: "Slack integration with OAuth flow and channel notifications",
    type: "feature",
  },
  {
    date: "2026-01-05",
    title: "Microsoft Teams integration with channel video sharing",
    type: "feature",
  },
  {
    date: "2026-01-05",
    title: "Zapier webhooks for workflow automation",
    type: "feature",
  },

  // 2026-01-04
  {
    date: "2026-01-04",
    title: "Share video moments with timestamped URLs",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Platform available in 15 languages",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "AI insights dashboard with topic trends and action item tracking",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Meeting effectiveness score with participation metrics",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Keyword cloud visualization for video content",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Semantic search finds videos by concept, not just keywords",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Find similar videos based on content analysis",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Admin control to disable new user signups",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "SSO/SAML settings for enterprise authentication",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Custom roles and permissions management",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Audit logs with filtering and CSV export",
    type: "feature",
  },
  {
    date: "2026-01-04",
    title: "Touch-friendly mobile experience with safe area support",
    type: "improvement",
  },

  // 2026-01-02
  {
    date: "2026-01-02",
    title: "Auto-detect key moments: decisions, action items, Q&A, demos",
    type: "feature",
  },
  {
    date: "2026-01-02",
    title: "Create clips from detected video moments",
    type: "feature",
  },
  {
    date: "2026-01-02",
    title: "Knowledge graph connects related videos and decisions",
    type: "feature",
  },
  {
    date: "2026-01-02",
    title: "Decision registry with searchable history",
    type: "feature",
  },
  {
    date: "2026-01-02",
    title: "Automatic speaker identification in transcripts",
    type: "feature",
  },
  {
    date: "2026-01-02",
    title: "Talk time distribution and participation balance metrics",
    type: "feature",
  },
  {
    date: "2026-01-02",
    title: "Fixed internal server error when loading knowledge context",
    type: "fix",
  },

  // 2026-01-01
  {
    date: "2026-01-01",
    title: "Activity feed shows organization-wide updates",
    type: "feature",
  },
  {
    date: "2026-01-01",
    title: "Interactive API documentation with OpenAPI spec",
    type: "feature",
  },
  {
    date: "2026-01-01",
    title: "Faster page loads with partial pre-rendering",
    type: "improvement",
  },
  {
    date: "2026-01-01",
    title: "Fixed environment variable handling in production",
    type: "fix",
  },
];
