import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function WorkspaceSettingsPage({
  params,
}: {
  params: { workspace: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Manage your workspace settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace Name</Label>
          <Input
            id="workspace-name"
            defaultValue={
              params.workspace === "vercel" ? "Vercel" : "Acme Inc."
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-slug">Workspace Slug</Label>
          <Input id="workspace-slug" defaultValue={params.workspace} />
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 border-t px-6 py-4 flex justify-between">
        <Button>Save Changes</Button>
        <Button variant="destructive">Delete Workspace</Button>
      </CardFooter>
    </Card>
  );
}
