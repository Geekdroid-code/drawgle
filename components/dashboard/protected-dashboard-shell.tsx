"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DynamicBreadcrumb } from "@/components/dashboard/dynamic-breadcrumb";
import { HeaderUser } from "@/components/dashboard/header-user";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { AuthenticatedUser, ProjectData } from "@/lib/types";

export function ProtectedDashboardShell({
  user,
  initialProjects,
  children,
}: {
  user: AuthenticatedUser;
  initialProjects: ProjectData[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const userData = {
    name: user.fullName ?? user.email ?? "Drawgle account",
    email: user.email ?? "Signed in",
    avatar: user.avatarUrl ?? "",
    id: user.id,
  };
  const isProjectCanvasRoute = /^\/project\/[^/]+$/.test(pathname) && pathname !== "/project/new";

  if (isProjectCanvasRoute) {
    return (
      <div className="h-svh overflow-hidden bg-[var(--dg-bg)]">
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} initialProjects={initialProjects} />
      <SidebarInset className="min-h-svh overflow-hidden bg-[var(--dg-bg)] text-[var(--dg-text)]">
        <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-4">
          <SidebarTrigger className="shrink-0" />
          <div className="min-w-0 flex-1">
            <DynamicBreadcrumb />
          </div>
          <HeaderUser user={userData} initialCreditBalance={0} />
        </header>
        <div className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
