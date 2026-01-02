import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { MissingFieldError, ValidationError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { DecisionRepository } from "@/lib/effect/services/decision-repository";
import type { DecisionFilters, DecisionWithSummary } from "@/lib/types";

// =============================================================================
// Helper: Format decision as markdown
// =============================================================================

function formatDecisionMarkdown(decision: DecisionWithSummary): string {
  const lines: string[] = [];

  lines.push(`## ${decision.summary}`);
  lines.push("");

  // Status and date
  const status = decision.status.charAt(0).toUpperCase() + decision.status.slice(1);
  const date = new Date(decision.decidedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  lines.push(`**Status:** ${status}`);
  lines.push(`**Decided:** ${date}`);
  lines.push(`**Source:** ${decision.source}`);
  lines.push("");

  // Context
  if (decision.context) {
    lines.push("### Context");
    lines.push("");
    lines.push(decision.context);
    lines.push("");
  }

  // Participants
  if (decision.participants.length > 0) {
    lines.push("### Participants");
    lines.push("");
    for (const p of decision.participants) {
      lines.push(`- ${p.user.name} (${p.user.email})`);
    }
    lines.push("");
  }

  // Tags
  if (decision.tagAssignments.length > 0) {
    lines.push("### Tags");
    lines.push("");
    const tags = decision.tagAssignments.map((ta) => `#${ta.tag.name}`).join(", ");
    lines.push(tags);
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

// =============================================================================
// GET /api/decisions/export - Export decisions in various formats
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const format = searchParams.get("format") ?? "json";

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Validate format
    if (format !== "json" && format !== "markdown" && format !== "csv") {
      return yield* Effect.fail(
        new ValidationError({
          message: "Format must be 'json', 'markdown', or 'csv'",
          field: "format",
        }),
      );
    }

    // Build filters
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const topics = searchParams.get("topics");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const filters: DecisionFilters = {
      ...(status === "decided" || status === "proposed" || status === "superseded" ? { status } : {}),
      ...(source === "meeting" || source === "adhoc" || source === "manual" ? { source } : {}),
      ...(topics ? { topics: topics.split(",").map((t) => t.trim()) } : {}),
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
    };

    // Fetch all decisions (with high limit)
    const decisionRepo = yield* DecisionRepository;
    const result = yield* decisionRepo.getDecisions(organizationId, filters, 1, 1000);

    return {
      format,
      decisions: result.data,
      total: result.pagination.total,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      return error._tag === "Some"
        ? mapErrorToApiResponse(error.value)
        : mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: ({ format, decisions, total }) => {
      if (format === "json") {
        return NextResponse.json(
          { decisions, total },
          {
            headers: {
              "Content-Disposition": 'attachment; filename="decisions.json"',
            },
          },
        );
      }

      if (format === "markdown") {
        const lines: string[] = [];
        lines.push("# Decision Registry Export");
        lines.push("");
        lines.push(`Exported: ${new Date().toISOString()}`);
        lines.push(`Total decisions: ${total}`);
        lines.push("");
        lines.push("---");
        lines.push("");

        for (const decision of decisions) {
          lines.push(formatDecisionMarkdown(decision));
        }

        return new NextResponse(lines.join("\n"), {
          headers: {
            "Content-Type": "text/markdown",
            "Content-Disposition": 'attachment; filename="decisions.md"',
          },
        });
      }

      if (format === "csv") {
        const lines: string[] = [];
        // Header row
        lines.push("ID,Summary,Status,Source,Decided At,Participants,Tags,Context");

        for (const decision of decisions) {
          const participants = decision.participants.map((p) => p.user.name).join("; ");
          const tags = decision.tagAssignments.map((ta) => ta.tag.name).join("; ");
          const context = (decision.context ?? "").replace(/"/g, '""');
          const summary = decision.summary.replace(/"/g, '""');

          lines.push(
            `"${decision.id}","${summary}","${decision.status}","${decision.source}","${decision.decidedAt}","${participants}","${tags}","${context}"`,
          );
        }

        return new NextResponse(lines.join("\n"), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="decisions.csv"',
          },
        });
      }

      return NextResponse.json({ decisions, total });
    },
  });
}
