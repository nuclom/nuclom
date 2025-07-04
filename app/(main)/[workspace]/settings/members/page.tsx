import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MoreHorizontal } from "lucide-react"

const members = [
  { name: "User Name", email: "user.name@example.com", role: "Owner", avatar: "/placeholder.svg?height=32&width=32" },
  { name: "Jane Doe", email: "jane.doe@example.com", role: "Admin", avatar: "/placeholder.svg?height=32&width=32" },
  {
    name: "John Smith",
    email: "john.smith@example.com",
    role: "Member",
    avatar: "/placeholder.svg?height=32&width=32",
  },
]

export default function MembersSettingsPage() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Members</CardTitle>
          <CardDescription>Manage who has access to this workspace.</CardDescription>
        </div>
        <Button>Invite Member</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.email}>
                <TableCell className="pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar || "/placeholder.svg"} />
                      <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell className="text-right pr-4">
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
