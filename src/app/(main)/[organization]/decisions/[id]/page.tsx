import process from "node:process";
import { ArrowLeft, Calendar, Edit, Link2, Trash2, Users, Video } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";
import { getOrganizationBySlug } from "@/lib/effect/server";

interface DecisionDetailPageProps {
  params: Promise<{ organization: string; id: string }>;
}

const statusColors: Record<string, string> = {
  decided: "bg-green-500/10 text-green-600 border-green-500/20",
  proposed: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  superseded: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const sourceLabels: Record<string, string> = {
  meeting: "Meeting",
  adhoc: "Ad-hoc",
  manual: "Manual",
};

export default async function DecisionDetailPage({ params }: DecisionDetailPageProps) {
  const { organization, id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    notFound();
  }

  const org = await getOrganizationBySlug(organization);
  if (!org) {
    notFound();
  }

  // Fetch decision details
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/decisions/${id}`, {
    headers: {
      cookie: (await headers()).get("cookie") || "",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    notFound();
  }

  const decision = await response.json();

  const formattedDecidedAt = new Date(decision.decidedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedCreatedAt = new Date(decision.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedUpdatedAt = new Date(decision.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/${organization}/decisions`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Decision Registry
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{decision.summary}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={statusColors[decision.status]}>
              {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
            </Badge>
            <Badge variant="secondary">{sourceLabels[decision.source] || decision.source}</Badge>
            {decision.tagAssignments?.map((ta: { tag: { id: string; name: string; color?: string } }) => (
              <Badge
                key={ta.tag.id}
                variant="outline"
                style={ta.tag.color ? { borderColor: ta.tag.color, color: ta.tag.color } : undefined}
              >
                #{ta.tag.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${organization}/decisions?edit=${decision.id}`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Context/Rationale */}
          <Card>
            <CardHeader>
              <CardTitle>Context & Rationale</CardTitle>
              <CardDescription>The background and reasoning behind this decision</CardDescription>
            </CardHeader>
            <CardContent>
              {decision.context ? (
                <p className="whitespace-pre-wrap">{decision.context}</p>
              ) : (
                <p className="text-muted-foreground italic">No context provided</p>
              )}
            </CardContent>
          </Card>

          {/* Video Link */}
          {decision.videoId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Linked Video
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/${organization}/videos/${decision.videoId}${decision.videoTimestamp ? `?t=${decision.videoTimestamp}` : ""}`}
                  className="text-primary hover:underline"
                >
                  View video
                  {decision.videoTimestamp !== undefined && decision.videoTimestamp !== null && (
                    <span> at {formatTimestamp(decision.videoTimestamp)}</span>
                  )}
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Linked Decisions */}
          {decision.links && decision.links.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Related Decisions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {decision.links.map(
                    (link: { id: string; targetDecision: { id: string; summary: string }; linkType: string }) => (
                      <li key={link.id} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {link.linkType}
                        </Badge>
                        <Link
                          href={`/${organization}/decisions/${link.targetDecision.id}`}
                          className="text-primary hover:underline"
                        >
                          {link.targetDecision.summary}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Superseded By */}
          {decision.supersededById && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Decision Superseded</CardTitle>
                <CardDescription>This decision has been replaced by a newer decision</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/${organization}/decisions/${decision.supersededById}`}
                  className="text-primary hover:underline"
                >
                  View superseding decision
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Decision Date</div>
                  <div className="text-muted-foreground">{formattedDecidedAt}</div>
                </div>
              </div>

              <Separator />

              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formattedCreatedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{formattedUpdatedAt}</span>
                </div>
              </div>

              {decision.createdBy && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Created by</span>
                    <div className="font-medium">{decision.createdBy.name || decision.createdBy.email}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Participants */}
          {decision.participants && decision.participants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Participants ({decision.participants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {decision.participants.map(
                    (participant: {
                      id: string;
                      user: { id: string; name?: string; email: string };
                      role?: string;
                    }) => (
                      <li key={participant.id} className="flex items-center justify-between text-sm">
                        <span>{participant.user.name || participant.user.email}</span>
                        {participant.role && (
                          <Badge variant="secondary" className="text-xs">
                            {participant.role}
                          </Badge>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Edit History */}
          {decision.edits && decision.edits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Edit History</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {decision.edits
                    .slice(0, 5)
                    .map(
                      (edit: {
                        id: string;
                        createdAt: string;
                        editedBy?: { name?: string; email: string };
                        fieldChanged: string;
                      }) => (
                        <li key={edit.id} className="border-l-2 border-muted pl-3">
                          <div className="font-medium">{edit.fieldChanged} modified</div>
                          <div className="text-muted-foreground text-xs">
                            {edit.editedBy?.name || edit.editedBy?.email || "Unknown"} -{" "}
                            {new Date(edit.createdAt).toLocaleDateString()}
                          </div>
                        </li>
                      ),
                    )}
                </ul>
                {decision.edits.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">+{decision.edits.length - 5} more edits</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
