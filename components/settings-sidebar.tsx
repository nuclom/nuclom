"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { User, Building, Users } from "lucide-react"

export function SettingsSidebar({ workspace }: { workspace: string }) {
  const pathname = usePathname()
  const navItems = [
    { href: `/${workspace}/settings/profile`, label: "Your Profile", icon: User },
    { href: `/${workspace}/settings/workspace`, label: "Workspace", icon: Building },
    { href: `/${workspace}/settings/members`, label: "Members", icon: Users },
  ]

  return (
    <aside className="w-full md:w-56 flex-shrink-0">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      <nav>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
