
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarClock,
  ListChecks,
  PanelLeft,
  LogIn,
  LogOut,
  UserPlus,
  UserCircle,
} from "lucide-react";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AquaFeedLogo } from "@/components/icons";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

const navItems = [
  { href: "/", label: "Home", icon: Home, authRequired: false },
  { href: "/schedule", label: "Time Schedule", icon: CalendarClock, authRequired: true },
  { href: "/log", label: "Feeding Log", icon: ListChecks, authRequired: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  const accessibleNavItems = navItems.filter(item => !item.authRequired || isAuthenticated);

  return (
      <div className="flex min-h-screen">
        <Sidebar className="bg-sidebar text-sidebar-foreground" collapsible="icon">
          <SidebarHeader className="p-4">
            <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              <AquaFeedLogo className="h-8 w-8 text-primary" />
              <span className="font-headline text-xl font-semibold text-primary group-data-[collapsible=icon]:hidden">
                AquaFeed
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {accessibleNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.label}
                      className={cn(
                        "justify-start",
                        pathname === item.href ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarSeparator className="my-2 group-data-[collapsible=icon]:hidden" />
          <SidebarFooter className="p-2">
            <div className="group-data-[collapsible=icon]:hidden flex justify-center mb-4">
              <DarkModeToggle />
            </div>
            {isLoading ? (
              <div className="space-y-2 p-2 group-data-[collapsible=icon]:hidden">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : isAuthenticated && user ? (
              <div className="group-data-[collapsible=icon]:hidden space-y-2 p-2">
                 <div className="flex items-center gap-2 text-sm text-sidebar-foreground/80 px-2 py-1 truncate">
                    <UserCircle className="h-5 w-5 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                <Button
                  onClick={logout}
                  variant="ghost"
                  className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="mr-2 h-5 w-5" /> Logout
                </Button>
              </div>
            ) : (
              <div className="group-data-[collapsible=icon]:hidden space-y-1 p-1">
                <Link href="/login">
                  <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <LogIn className="mr-2 h-5 w-5" /> Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                     <UserPlus className="mr-2 h-5 w-5" /> Sign Up
                  </Button>
                </Link>
              </div>
            )}
            <p className="text-xs text-sidebar-foreground/70 text-center mt-2 group-data-[collapsible=icon]:hidden">
              &copy; {new Date().getFullYear()} AquaFeed Inc.
            </p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 bg-background">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:hidden">
              <SidebarTrigger className="md:hidden">
                <PanelLeft className="h-6 w-6" />
                <span className="sr-only">Toggle Sidebar</span>
              </SidebarTrigger>
              <Link href="/" className="flex items-center gap-2">
                 <AquaFeedLogo className="h-7 w-7 text-primary" />
                 <span className="font-headline text-lg font-semibold text-primary">AquaFeed</span>
              </Link>
            </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
  );
}
