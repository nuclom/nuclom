import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { VideoUpload } from "@/components/video-upload";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

export default async function UploadPage({ params }: { params: Promise<{ organization: string }> }) {
  const { organization: organizationSlug } = await params;

  // Get user from session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  // Get organization by slug
  const organization = await db.select().from(organizations).where(eq(organizations.slug, organizationSlug)).limit(1);

  if (!organization.length) {
    redirect("/");
  }

  const authorId = session.user.id;
  const organizationId = organization[0].id;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="flex items-center gap-2">
            <Link href={`/${organizationSlug}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to Videos
            </Link>
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Upload Video</h1>
          <p className="text-muted-foreground">Upload a new video to your organization</p>
        </div>

        {/* Upload Component */}
        <VideoUpload organizationId={organizationId} authorId={authorId} />
      </div>
    </div>
  );
}
