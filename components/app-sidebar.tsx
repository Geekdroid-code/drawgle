"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, Plus, Search, Trash2, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar as SidebarRoot, SidebarInput } from "@/components/ui/sidebar";
import {
  Sidebar001,
  Sidebar001Content,
  Sidebar001Footer,
  Sidebar001Header,
  Sidebar001Item,
  Sidebar001Section,
} from "@/components/stylish-sidebar";
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
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
  const diffInDays = Math.floor(
    (startOfLocalDay(new Date().toISOString()) - startOfLocalDay(updatedAt)) / DAY_IN_MS,
  );

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

  return new Date(updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const getStatusDotClass = (status: ProjectData["status"]) => {
  if (status === "failed") {
    return "bg-rose-500";
  }

  if (status === "generating" || status === "queued") {
    return "bg-[#002fa7]";
  }

  if (status === "active") {
    return "bg-emerald-500";
  }

  return "bg-neutral-300";
};

const getAccountInitial = (user: AuthenticatedUser) => (
  user.fullName?.charAt(0) || user.email?.charAt(0) || "U"
);

export function AppSidebar({
  user,
  onSignOut,
  currentProjectId,
  initialProjects = EMPTY_PROJECTS,
  ...props
}: AppSidebarProps & ComponentProps<typeof SidebarRoot>) {
  const router = useRouter();
  const { projects, deleteProject } = useProjects(user.id, initialProjects);
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
    <SidebarRoot
      collapsible="offcanvas"
      className="border-r border-slate-950/[0.08] bg-white text-neutral-950"
      {...props}
    >
      <Sidebar001
        fluid
        resizable={false}
        defaultEffectsEnabled
        className="bg-white [--accent-pro:#002fa7]"
      >
        <Sidebar001Header className="border-b border-slate-950/[0.06] px-4 pb-4 pt-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push("/project/new")}
              className="flex min-w-0 items-center gap-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full dg-control text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-950">
                DG
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Workspace
                </span>
                <span className="block truncate text-base font-semibold tracking-tight text-neutral-950">
                  Drawgle
                </span>
              </span>
            </button>

            <Avatar className="h-9 w-9 shrink-0 border border-slate-950/[0.08] bg-white">
              <AvatarImage src={user.avatarUrl || ""} />
              <AvatarFallback>{getAccountInitial(user)}</AvatarFallback>
            </Avatar>
          </div>

          <Button
            type="button"
            onClick={() => router.push("/project/new")}
            className={cn(
              "mt-4 h-10 w-full justify-start rounded-lg px-4 text-sm font-medium",
              currentProjectId
                ? "dg-control text-neutral-700 hover:bg-white"
                : "dg-button-primary text-white",
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <SidebarInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="h-11 rounded-lg border-slate-950/[0.08] bg-[#f7f7f8] pl-10 text-sm text-neutral-900 shadow-none focus-visible:ring-[#002fa7]/15"
            />
          </div>
        </Sidebar001Header>

        <Sidebar001Content className="px-3 pb-4 pt-2">
          {visibleGroups.map((label) => (
            <Sidebar001Section
              key={label}
              className="mb-3"
              label={(
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  {label}
                </span>
              )}
            >
              <div className="space-y-0.5">
                {groupedProjects[label].map((project) => (
                  <ProjectMenuItem
                    key={project.id}
                    project={project}
                    active={project.id === currentProjectId}
                    onDelete={() => deleteProject(project.id)}
                  />
                ))}
              </div>
            </Sidebar001Section>
          ))}

          {filteredProjects.length === 0 ? (
            <div className="mx-1 mt-3 rounded-lg border border-dashed border-slate-950/[0.12] bg-[#f7f7f8] px-4 py-5 text-sm leading-6 text-neutral-500">
              {query.trim()
                ? "No projects match that search."
                : "No projects yet. Start the first one from this workspace."}
            </div>
          ) : null}

          {!currentProjectId ? (
            <div className="mx-1 mt-6 rounded-lg border border-slate-950/[0.06] bg-[#f7f7f8] px-4 py-4 text-sm leading-6 text-neutral-600">
              New projects start here. The brief becomes the charter, design system, screen plan, and build kickoff.
            </div>
          ) : null}
        </Sidebar001Content>

        <Sidebar001Footer className="border-t border-slate-950/[0.06] px-4 pb-4 pt-3">
          <div className="flex items-center gap-3 rounded-lg border border-slate-950/[0.07] bg-[#f8f8f9] px-3 py-3">
            <Avatar className="h-10 w-10 border border-slate-950/[0.08] bg-white">
              <AvatarImage src={user.avatarUrl || ""} />
              <AvatarFallback>{getAccountInitial(user)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-neutral-950">
                {user.fullName ?? "Drawgle account"}
              </div>
              <div className="truncate text-xs text-neutral-500">
                {user.email ?? "Signed in"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-neutral-500 hover:bg-white hover:text-neutral-950"
              onClick={onSignOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </Sidebar001Footer>
      </Sidebar001>
    </SidebarRoot>
  );
}

function ProjectMenuItem({
  project,
  active = false,
  onDelete,
}: {
  project: ProjectData;
  active?: boolean;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const context = getProjectContext(project);
  const status = PROJECT_STATUS_LABEL[project.status] ?? "Project";
  const time = formatCompactTime(project.updatedAt);
  const href = `/project/${project.id}`;

  return (
    <div className="group/project relative">
      <Sidebar001Item
        href={href}
        isActive={active}
        onClick={(event) => {
          event.preventDefault();
          router.push(href);
        }}
        className="min-h-[46px] w-[calc(100%-0.5rem)] rounded-md py-2 pr-9 text-neutral-950"
        label={(
          <span className="block min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                {project.name}
              </span>
              <span className="shrink-0 text-[11px] text-neutral-400">
                {time}
              </span>
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-neutral-500">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", getStatusDotClass(project.status))} />
              <span className="min-w-0 truncate">{context}</span>
              <span className="shrink-0 text-neutral-300">/</span>
              <span className="shrink-0">{status}</span>
            </span>
          </span>
        )}
      />

      {confirming ? (
        <div className="absolute right-1 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              onDelete();
            }}
            className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
            aria-label="Confirm delete"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
            aria-label="Cancel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="absolute right-1.5 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 focus-visible:opacity-100 group-hover/project:opacity-100"
          aria-label="Delete project"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
