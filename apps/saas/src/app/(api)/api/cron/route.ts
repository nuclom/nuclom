/**
 * Cron Endpoint for Periodic Workflows
 *
 * This endpoint is triggered by Vercel Cron Jobs to start periodic workflows.
 * The Workflow DevKit handles durability - workflows will resume from where they
 * left off if interrupted.
 *
 * Cron schedules are configured in vercel.ts at the project root.
 *
 * Security: Set CRON_SECRET environment variable in Vercel.
 * Vercel automatically sends it as Authorization header.
 *
 * Workflows:
 * - subscriptionEnforcementWorkflow: Daily billing policy enforcement
 * - scheduledCleanupWorkflow: Daily cleanup of expired videos
 * - uptimeMonitorWorkflow: Continuous health monitoring (5-min intervals)
 */

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { env } from '@/lib/env/server';
import { scheduledCleanupWorkflow } from '@/workflows/scheduled-cleanup';
import { subscriptionEnforcementWorkflow } from '@/workflows/subscription-enforcement';
import { uptimeMonitorWorkflow } from '@/workflows/uptime-monitor';

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron or has valid authorization
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const cronHeader = headersList.get('x-cron-secret');
  const cronSecret = env.CRON_SECRET;

  // In production, verify the cron secret
  if (env.NODE_ENV === 'production' && cronSecret) {
    const hasBearer = authHeader === `Bearer ${cronSecret}`;
    const hasRaw = authHeader === cronSecret;
    const hasCronHeader = cronHeader === cronSecret;

    if (!hasBearer && !hasRaw && !hasCronHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const workflow = url.searchParams.get('workflow');

  try {
    const results: Record<string, string> = {};

    // Start specific workflow or all periodic workflows
    if (!workflow || workflow === 'enforcement') {
      await start(subscriptionEnforcementWorkflow, []);
      results.enforcement = 'started';
    }

    if (!workflow || workflow === 'cleanup') {
      await start(scheduledCleanupWorkflow, []);
      results.cleanup = 'started';
    }

    if (!workflow || workflow === 'uptime') {
      await start(uptimeMonitorWorkflow, [{ intervalMs: 5 * 60 * 1000 }]);
      results.uptime = 'started';
    }

    return NextResponse.json({
      success: true,
      workflows: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Failed to start workflows:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
