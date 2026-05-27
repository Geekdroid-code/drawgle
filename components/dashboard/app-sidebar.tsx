"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  CreditCard,
  FolderPlus,
  LayoutDashboard,
  Loader2,
  MoreVertical,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";

import { NavSecondary } from "@/components/dashboard/nav-secondary";
import { NavUser } from "@/components/dashboard/nav-user";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProjects } from "@/hooks/use-projects";
import { useCreditManager } from "@/lib/credit-manager";
import { cn } from "@/lib/utils";
import type { AuthenticatedUser, ProjectData } from "@/lib/types";

const DAY_IN_MS = 86_400_000;
const PROJECT_GROUP_ORDER = ["Today", "Yesterday", "Last 7 days", "Earlier"] as const;

const navSecondary = [
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
  },
];

const startOfLocalDay = (value: string) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const getGroupLabel = (updatedAt: string) => {
  const diffInDays = Math.floor(
    (startOfLocalDay(new Date().toISOString()) - startOfLocalDay(updatedAt)) / DAY_IN_MS,
  );

  if (diffInDays <= 0) return "Today";
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return "Last 7 days";
  return "Earlier";
};

const formatCompactTime = (updatedAt: string) => {
  const timestamp = new Date(updatedAt).getTime();
  const diff = Math.max(Date.now() - timestamp, 0);
  const minute = 60_000;
  const hour = 60 * minute;

  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < DAY_IN_MS) return `${Math.floor(diff / hour)}h`;
  if (diff < DAY_IN_MS * 7) return `${Math.floor(diff / DAY_IN_MS)}d`;

  return new Date(updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

function CreditsCard({ userId }: { userId: string }) {
  const { balance, loading } = useCreditManager(userId);

  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/45 p-3 group-data-[collapsible=icon]:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Credits</div>
          <div className="mt-1 text-xs text-sidebar-foreground/70">
            {loading ? "Loading balance..." : `${balance.toLocaleString()} available`}
          </div>
        </div>
        <Sparkles className="size-4 shrink-0 text-sidebar-foreground/70" />
      </div>
      <Link
        href="/billing"
        prefetch={false}
        className="mt-3 flex h-8 items-center justify-center rounded-md bg-sidebar-primary px-3 text-xs font-medium text-sidebar-primary-foreground transition hover:opacity-90"
      >
        Upgrade plan
      </Link>
    </div>
  );
}

function ProjectGroups({
  userId,
  initialProjects,
}: {
  userId: string;
  initialProjects: ProjectData[];
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { projects, deleteProject, hasMore, loadMore, isLoadingMore } = useProjects(userId, initialProjects);
  const [query, setQuery] = React.useState("");
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  const sentinelCallbackRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore || isLoadingMore) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            void loadMore();
          }
        },
        { rootMargin: "100px" },
      );
      observerRef.current.observe(node);
    },
    [hasMore, isLoadingMore, loadMore],
  );

  const filteredProjects = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return projects;

    return projects.filter((project) => (
      project.name.toLowerCase().includes(normalizedQuery)
      || project.prompt.toLowerCase().includes(normalizedQuery)
    ));
  }, [projects, query]);

  const groupedProjects = React.useMemo(
    () => filteredProjects.reduce<Record<string, ProjectData[]>>((groups, project) => {
      const label = getGroupLabel(project.updatedAt);
      groups[label] = groups[label] ?? [];
      groups[label].push(project);
      return groups;
    }, {}),
    [filteredProjects],
  );

  const visibleGroups = PROJECT_GROUP_ORDER.filter((label) => groupedProjects[label]?.length);

  return (
    <>
     

      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <div className="relative px-2 pb-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/45" />
          <SidebarInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            className="pl-8"
          />
        </div>

        <div className="min-h-0 space-y-4">
          {visibleGroups.map((label) => (
            <div key={label}>
              <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/45 mt-3">
                {label}
              </div>
              <SidebarMenu>
                {groupedProjects[label].map((project) => (
                  <ProjectMenuItem
                    key={project.id}
                    project={project}
                    active={pathname === `/project/${project.id}`}
                    onDelete={() => deleteProject(project.id)}
                    onNavigate={() => setOpenMobile(false)}
                  />
                ))}
              </SidebarMenu>
            </div>
          ))}

          {hasMore ? (
            <div ref={sentinelCallbackRef} className="flex justify-center py-3">
              {isLoadingMore ? (
                <Loader2 className="size-4 animate-spin text-sidebar-foreground/50" />
              ) : (
                <span className="text-xs text-sidebar-foreground/50">Loading more...</span>
              )}
            </div>
          ) : null}

          {filteredProjects.length === 0 ? (
            <div className="mx-2 rounded-lg border border-dashed border-sidebar-border px-3 py-4 text-center text-sm leading-5 text-sidebar-foreground/55">
              {query.trim()
                ? "No projects match that search."
                : "No projects yet. Start the first one from this workspace."}
            </div>
          ) : null}
        </div>
      </SidebarGroup>
    </>
  );
}

function ProjectMenuItem({
  project,
  active,
  onDelete,
  onNavigate,
}: {
  project: ProjectData;
  active: boolean;
  onDelete: () => void;
  onNavigate: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/project/${project.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy project link", error);
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            href={`/project/${project.id}`}
            prefetch={false}
            onClick={onNavigate}
          />
        }
        isActive={active}
        tooltip={project.name}
        className={cn("h-9 pr-14", active && "font-medium")}
      >
        <span className="size-2 shrink-0 rounded-full bg-sidebar-foreground/35" />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction
              showOnHover
              aria-label="Project actions"
              className="right-1.5 top-1.5 size-6 bg-sidebar-accent shadow-sm"
            />
          }
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-40">
          <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
            {copied ? <Check /> : <Share2 />}
            {copied ? "Copied!" : "Share project"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            variant="destructive"
            className="cursor-pointer"
          >
            <Trash2 />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-sidebar-foreground/40 transition-opacity group-hover/menu-item:opacity-0 group-focus-within/menu-item:opacity-0 group-data-[collapsible=icon]:hidden">
        {formatCompactTime(project.updatedAt)}
      </div>
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={onDelete}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.name}"? This action is permanent and cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  user,
  initialProjects,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: AuthenticatedUser;
  initialProjects: ProjectData[];
}) {
  const userData = {
    name: user.fullName ?? user.email ?? "Drawgle account",
    email: user.email ?? "Signed in",
    avatar: user.avatarUrl ?? "",
    id: user.id,
  };

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/project/new" prefetch={false} />}
              tooltip="Drawgle"
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold tracking-wider text-sidebar-primary-foreground">
                DG
              </span>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Drawgle</span>
                <span className="truncate text-xs">AI App UI Generator</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Link
          href="/project/new"
          prefetch={false}
          className="mx-2 flex h-9 items-center justify-center gap-2 rounded-lg bg-sidebar-primary px-3 text-sm font-medium text-sidebar-primary-foreground transition hover:opacity-90 group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0"
        >
          <FolderPlus className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">New project</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <ProjectGroups userId={user.id} initialProjects={initialProjects} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <CreditsCard userId={user.id} />
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
