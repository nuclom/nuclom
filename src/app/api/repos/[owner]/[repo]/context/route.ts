import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { CodeLinksRepository } from "@/lib/effect";

// =============================================================================
// GET /api/repos/[owner]/[repo]/context - Get all video context for a repository
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const effect = Effect.gen(function* () {
    const { owner, repo } = yield* Effect.promise(() => params);
    const fullRepoName = `${owner}/${repo}`;

    const codeLinksRepo = yield* CodeLinksRepository;

    // Get repository summary (counts by type)
    const summary = yield* codeLinksRepo.getRepoSummary(fullRepoName);

    // Get all code links for the repository
    const links = yield* codeLinksRepo.getCodeLinksForRepo(fullRepoName, 100, 0);

    // Get top videos for the repository
    const topVideos = yield* codeLinksRepo.searchVideosForRepo(fullRepoName, undefined, 10);

    // Group links by type
    const prs = links.filter((l) => l.linkType === "pr");
    const issues = links.filter((l) => l.linkType === "issue");
    const commits = links.filter((l) => l.linkType === "commit");
    const files = links.filter((l) => l.linkType === "file");
    const directories = links.filter((l) => l.linkType === "directory");

    // Get unique PRs, issues, etc. with their videos
    const groupByRef = (items: typeof links) => {
      const grouped = new Map<string, (typeof links)[0][]>();
      for (const item of items) {
        const existing = grouped.get(item.githubRef) || [];
        existing.push(item);
        grouped.set(item.githubRef, existing);
      }
      return Array.from(grouped.entries()).map(([ref, videos]) => ({
        ref,
        url: videos[0].githubUrl,
        videoCount: videos.length,
        videos: videos.map((v) => ({
          id: v.videoId,
          title: v.video.title,
          thumbnailUrl: v.video.thumbnailUrl,
          timestamp: v.timestampStart,
          context: v.context,
        })),
      }));
    };

    return {
      success: true,
      data: {
        repository: fullRepoName,
        summary: {
          totalLinks: links.length,
          byType: Object.fromEntries(summary.map((s) => [s.linkType, s.count])),
        },
        topVideos: topVideos.map((v) => ({
          id: v.videoId,
          title: v.videoTitle,
          thumbnailUrl: v.thumbnailUrl,
          linkCount: v.linkCount,
          latestLinkAt: v.latestLinkAt,
        })),
        prs: groupByRef(prs),
        issues: groupByRef(issues),
        commits: groupByRef(commits),
        files: groupByRef(files),
        directories: groupByRef(directories),
      },
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
