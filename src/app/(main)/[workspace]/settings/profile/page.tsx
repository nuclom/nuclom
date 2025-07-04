import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export default function ProfileSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
        <CardDescription>Manage your personal information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src="/placeholder.svg?height=80&width=80" />
            <AvatarFallback>UN</AvatarFallback>
          </Avatar>
          <Button variant="outline">Change Photo</Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" defaultValue="User Name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            defaultValue="user.name@example.com"
            disabled
          />
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 border-t px-6 py-4">
        <Button>Save Changes</Button>
      </CardFooter>
    </Card>
  );
}
