"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Plus, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useProjects } from "@/hooks/use-projects";
import type { AuthenticatedUser, ProjectData } from "@/lib/types";

type AppSidebarProps = {
  user: AuthenticatedUser;
  onSignOut: () => void;
  currentProjectId?: string;
  initialProjects?: ProjectData[];
};

const EMPTY_PROJECTS: ProjectData[] = [];
const DAY_IN_MS = 86_400_000;
const PROJECT_GROUP_ORDER = ["Today", "Yesterday", "Last 7 days", "Earlier"] as const;

const startOfLocalDay = (value: string) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const getGroupLabel = (updatedAt: string) => {
  const diffInDays = Math.floor((startOfLocalDay(new Date().toISOString()) - startOfLocalDay(updatedAt)) / DAY_IN_MS);

  if (diffInDays <= 0) {
    return "Today";
  }

  if (diffInDays === 1) {
    return "Yesterday";
  }

  if (diffInDays < 7) {
    return "Last 7 days";
  }

  return "Earlier";
};

export function AppSidebar({
  user,
  onSignOut,
  currentProjectId,
  initialProjects = EMPTY_PROJECTS,
  ...props
}: AppSidebarProps & ComponentProps<typeof SidebarRoot>) {
  const router = useRouter();
  const { projects } = useProjects(user.id, initialProjects);
  const [query, setQuery] = useState("");

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) => (
      project.name.toLowerCase().includes(normalizedQuery)
      || project.prompt.toLowerCase().includes(normalizedQuery)
    ));
  }, [projects, query]);

  const groupedProjects = useMemo(
    () => filteredProjects.reduce<Record<string, ProjectData[]>>((groups, project) => {
      const label = getGroupLabel(project.updatedAt);

      if (!groups[label]) {
        groups[label] = [];
      }

      groups[label].push(project);
      return groups;
    }, {}),
    [filteredProjects],
  );

  const visibleGroups = PROJECT_GROUP_ORDER.filter((label) => groupedProjects[label]?.length);

  return (
    <SidebarRoot collapsible="offcanvas" className="border-r-0" {...props}>
      <SidebarHeader className="gap-4 px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/project/new")}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-950">
              DG
            </span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Workspace</span>
              <span className="block text-base font-semibold tracking-tight text-neutral-950">Drawgle</span>
            </span>
          </button>

          <Avatar className="h-9 w-9 border border-black/10">
            <AvatarImage src={user.avatarUrl || ""} />
            <AvatarFallback>{user.fullName?.charAt(0) || user.email?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
        </div>

        <Button
          type="button"
          onClick={() => router.push("/project/new")}
          className={`h-10 w-full justify-start rounded-full px-4 text-sm font-medium ${
            currentProjectId
              ? "bg-white text-neutral-700 hover:bg-white/90"
              : "bg-neutral-950 text-white hover:bg-neutral-800"
          }`}
        >
          <Plus className="mr-2 h-4 w-4" />
          New project
        </Button>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <SidebarInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            className="h-11 rounded-full border-black/10 bg-white pl-10 text-sm text-neutral-900"
          />
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent className="gap-0 pb-2">
        <SidebarGroup className="px-3 py-3">
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Projects
          </SidebarGroupLabel>
          <SidebarGroupContent className="space-y-5 pt-1">
            {visibleGroups.map((label) => (
              <div key={label}>
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{label}</div>
                <SidebarMenu className="mt-2 gap-1.5">
                  {groupedProjects[label].map((project) => (
                    <ProjectMenuItem
                      key={project.id}
                      id={project.id}
                      title={project.name}
                      prompt={project.prompt || "Start from the protected workspace prompt composer."}
                      date={new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      active={project.id === currentProjectId}
                    />
                  ))}
                </SidebarMenu>
              </div>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredProjects.length === 0 ? (
          <SidebarGroup className="px-3 pt-0">
            <div className="rounded-[24px] border border-dashed border-black/10 bg-white/55 px-4 py-5 text-sm leading-6 text-neutral-500">
              {query.trim() ? "No projects match that search." : "No projects yet. Start the first one from this workspace."}
            </div>
          </SidebarGroup>
        ) : null}

        {!currentProjectId ? (
          <SidebarGroup className="mt-auto px-3 pb-3 pt-2">
            <div className="rounded-[24px] border border-black/8 bg-white/60 px-4 py-4 text-sm leading-6 text-neutral-600">
              New projects start here. The brief, design system, planning, and build kickoff stay inside this protected workspace.
            </div>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      <SidebarFooter className="px-4 py-4">
        <div className="flex items-center gap-3 rounded-[22px] bg-white/70 px-3 py-3">
          <Avatar className="h-10 w-10 border border-black/10">
            <AvatarImage src={user.avatarUrl || ""} />
            <AvatarFallback>{user.fullName?.charAt(0) || user.email?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-neutral-950">{user.fullName ?? "Drawgle account"}</div>
            <div className="truncate text-xs text-neutral-500">{user.email ?? "Signed in"}</div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-neutral-500 hover:text-neutral-950" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </SidebarRoot>
  );
}

function ProjectMenuItem({
  id,
  title,
  prompt,
  date,
  active = false,
}: {
  id: string;
  title: string;
  prompt: string;
  date: string;
  active?: boolean;
}) {
  const router = useRouter();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<button type="button" onClick={() => router.push(`/project/${id}`)} />}
        isActive={active}
        className="h-auto items-start gap-3 rounded-[22px] border border-transparent px-3 py-3 text-neutral-950 hover:border-black/8 hover:bg-white/70 data-[active=true]:border-black/12 data-[active=true]:bg-white [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:text-neutral-400"
      >
        <LayoutGrid />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-neutral-950">{title}</span>
          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-neutral-500">{prompt}</span>
          <span className="mt-3 block text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">{date}</span>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
