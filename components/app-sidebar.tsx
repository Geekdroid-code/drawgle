"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Layers3, LogOut, Plus, Search } from "lucide-react";

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
const PROJECT_STATUS_LABEL: Record<ProjectData["status"], string> = {
  draft: "Draft",
  active: "Active",
  queued: "Queued",
  generating: "Building",
  failed: "Needs attention",
  completed: "Ready",
  archived: "Archived",
};

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

const getProjectContext = (project: ProjectData) => {
  if (project.charter?.appType) {
    return project.charter.appType;
  }

  if (project.charter?.creativeDirection?.conceptName) {
    return project.charter.creativeDirection.conceptName;
  }

  return PROJECT_STATUS_LABEL[project.status] ?? "Design project";
};

const formatCompactTime = (updatedAt: string) => {
  const timestamp = new Date(updatedAt).getTime();
  const diff = Math.max(Date.now() - timestamp, 0);
  const minute = 60_000;
  const hour = 60 * minute;

  if (diff < minute) {
    return "now";
  }

  if (diff < hour) {
    return `${Math.floor(diff / minute)}m`;
  }

  if (diff < DAY_IN_MS) {
    return `${Math.floor(diff / hour)}h`;
  }

  if (diff < DAY_IN_MS * 7) {
    return `${Math.floor(diff / DAY_IN_MS)}d`;
  }

  return new Date(updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
    <SidebarRoot collapsible="offcanvas" className="border-r border-slate-950/[0.08] bg-white" {...props}>
      <SidebarHeader className="gap-4 px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/project/new")}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full dg-control text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-950">
              DG
            </span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Workspace</span>
              <span className="block text-base font-semibold tracking-tight text-neutral-950">Drawgle</span>
            </span>
          </button>

          <Avatar className="h-9 w-9 border border-slate-950/[0.08]">
            <AvatarImage src={user.avatarUrl || ""} />
            <AvatarFallback>{user.fullName?.charAt(0) || user.email?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
        </div>

        <Button
          type="button"
          onClick={() => router.push("/project/new")}
          className={`h-10 w-full justify-start rounded-lg px-4 text-sm font-medium ${
            currentProjectId
              ? "dg-control text-neutral-700 hover:bg-white"
              : "dg-button-primary text-white"
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
            className="h-11 rounded-lg border-slate-950/[0.08] bg-[#f7f7f8] pl-10 text-sm text-neutral-900 shadow-none focus-visible:ring-[#002fa7]/15"
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
                      project={project}
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
            <div className="rounded-[20px] border border-dashed border-slate-950/[0.12] bg-[#f7f7f8] px-4 py-5 text-sm leading-6 text-neutral-500">
              {query.trim() ? "No projects match that search." : "No projects yet. Start the first one from this workspace."}
            </div>
          </SidebarGroup>
        ) : null}

        {!currentProjectId ? (
          <SidebarGroup className="mt-auto px-3 pb-3 pt-2">
            <div className="rounded-[20px] dg-panel-flat bg-[#f7f7f8] px-4 py-4 text-sm leading-6 text-neutral-600">
              New projects start here. The brief, design system, planning, and build kickoff stay inside this protected workspace.
            </div>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      <SidebarFooter className="px-4 py-4">
        <div className="flex items-center gap-3 rounded-[22px] dg-panel-flat px-3 py-3">
          <Avatar className="h-10 w-10 border border-slate-950/[0.08]">
            <AvatarImage src={user.avatarUrl || ""} />
            <AvatarFallback>{user.fullName?.charAt(0) || user.email?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-neutral-950">{user.fullName ?? "Drawgle account"}</div>
            <div className="truncate text-xs text-neutral-500">{user.email ?? "Signed in"}</div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-neutral-500 hover:bg-[#f7f7f8] hover:text-neutral-950" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </SidebarRoot>
  );
}

function ProjectMenuItem({
  project,
  active = false,
}: {
  project: ProjectData;
  active?: boolean;
}) {
  const router = useRouter();
  const context = getProjectContext(project);
  const status = PROJECT_STATUS_LABEL[project.status] ?? "Project";
  const time = formatCompactTime(project.updatedAt);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<button type="button" onClick={() => router.push(`/project/${project.id}`)} />}
        isActive={active}
        className="h-auto items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-neutral-950 hover:border-slate-950/[0.06] hover:bg-[#f5f5f6] data-[active=true]:border-slate-950/[0.1] data-[active=true]:bg-[#f1f1f2] data-[active=true]:shadow-none [&>svg]:size-3.5 [&>svg]:text-neutral-400"
      >
        <Layers3 />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{project.name}</span>
            <span className="shrink-0 text-xs text-neutral-400">{time}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-neutral-500">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                project.status === "failed"
                  ? "bg-rose-500"
                  : project.status === "generating" || project.status === "queued"
                    ? "bg-[#002fa7]"
                    : "bg-neutral-300"
              }`}
            />
            <span className="truncate">{context}</span>
            <span className="shrink-0 text-neutral-300">/</span>
            <span className="shrink-0">{status}</span>
          </div>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
