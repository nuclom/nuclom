"use client";

import { GitBranch, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCodeLinks } from "@/hooks/use-code-links";
import { AddCodeLinkDialog } from "./add-code-link-dialog";
import { CodeLinks } from "./code-links";

// =============================================================================
// Code Links Section Component
// =============================================================================

interface CodeLinksSectionProps {
  videoId: string;
  currentUserId?: string;
}

export function CodeLinksSection({ videoId, currentUserId }: CodeLinksSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { codeLinks, loading, error, addCodeLink, deleteCodeLink } = useCodeLinks(videoId);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              GitHub Code Links {codeLinks.length > 0 && `(${codeLinks.length})`}
            </CardTitle>
            {currentUserId && (
              <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <CodeLinks
            codeLinks={codeLinks}
            loading={loading}
            error={error}
            currentUserId={currentUserId}
            onDelete={deleteCodeLink}
          />
        </CardContent>
      </Card>

      <AddCodeLinkDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={addCodeLink} />
    </>
  );
}
