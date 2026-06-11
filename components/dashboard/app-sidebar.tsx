"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
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

import { AgentBall } from "@/components/AgentBall";
import { NavSecondary } from "@/components/dashboard/nav-secondary";
import { NavUser } from "@/components/dashboard/nav-user";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
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
        className="mt-3 flex h-8 items-center justify-center rounded-md dg-button-primary hover:dg-button-primary px-3 text-xs font-medium text-sidebar-primary-foreground transition hover:opacity-90"
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
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center pb-2">
            <Search className="size-4 text-sidebar-foreground/45" />
          </div>
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
  const [isActionsOpen, setIsActionsOpen] = React.useState(false);
  const [hoveredAction, setHoveredAction] = React.useState<string | null>(null);
  const [menuPosition, setMenuPosition] = React.useState<{ left: number; top: number } | null>(null);
  const actionButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const actionMenuRef = React.useRef<HTMLDivElement | null>(null);

  const updateActionMenuPosition = React.useCallback(() => {
    const button = actionButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 172;
    const menuHeight = 92;
    const gap = 8;
    const viewportPadding = 8;
    const opensRight = rect.right + gap + menuWidth <= window.innerWidth - viewportPadding;
    const left = opensRight ? rect.right + gap : Math.max(viewportPadding, rect.left - menuWidth - gap);
    const top = Math.min(
      Math.max(viewportPadding, rect.top - 8),
      window.innerHeight - menuHeight - viewportPadding,
    );

    setMenuPosition({ left, top });
  }, []);

  React.useEffect(() => {
    if (!isActionsOpen) return;

    updateActionMenuPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !actionButtonRef.current?.contains(target)
        && !actionMenuRef.current?.contains(target)
      ) {
        setIsActionsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updateActionMenuPosition);
    window.addEventListener("scroll", updateActionMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updateActionMenuPosition);
      window.removeEventListener("scroll", updateActionMenuPosition, true);
    };
  }, [isActionsOpen, updateActionMenuPosition]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/project/${project.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy project link", error);
    }
  };

  const openActions = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsActionsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        requestAnimationFrame(updateActionMenuPosition);
      }
      return nextOpen;
    });
  };

  const actionMenu = (
    <AnimatePresence>
      {isActionsOpen && menuPosition ? (
        <motion.div
          ref={actionMenuRef}
          initial={{ opacity: 0, scale: 0.92, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -3 }}
          transition={{ type: "spring", damping: 32, stiffness: 420, mass: 0.75 }}
          style={{ left: menuPosition.left, top: menuPosition.top, width: 172 }}
          className="fixed z-[9999] overflow-hidden rounded-[14px] border border-slate-950/[0.08] bg-white p-1.5 shadow-[0_20px_70px_rgba(15,23,42,0.15)] dark:border-white/[0.08] dark:bg-[#1b1b1b] dark:shadow-[0_20px_70px_rgba(0,0,0,0.55)]"
        >
          {[
            {
              id: "share",
              label: copied ? "Copied!" : "Share project",
              icon: copied ? Check : Share2,
              onClick: handleShare,
              destructive: false,
            },
            {
              id: "delete",
              label: "Delete project",
              icon: Trash2,
              onClick: () => setIsDeleteDialogOpen(true),
              destructive: true,
            },
          ].map((item, index) => {
            const Icon = item.icon;
            const active = hoveredAction === item.id;

            return (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 + index * 0.02, duration: 0.14 }}
                onMouseEnter={() => setHoveredAction(item.id)}
                onMouseLeave={() => setHoveredAction(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  item.onClick();
                  setIsActionsOpen(false);
                }}
                className={cn(
                  "relative flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-semibold transition-colors",
                  item.destructive
                    ? "text-rose-600/85 hover:text-rose-600 dark:text-rose-400/85 dark:hover:text-rose-400"
                    : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="project-action-hover"
                    className={cn(
                      "absolute inset-0 -z-10 rounded-lg",
                      item.destructive ? "bg-rose-50 dark:bg-rose-950/20" : "bg-slate-50 dark:bg-white/5",
                    )}
                    transition={{ type: "spring", damping: 30, stiffness: 520, mass: 0.8 }}
                  />
                ) : null}
                {active ? (
                  <motion.span
                    layoutId="project-action-bar"
                    className={cn(
                      "absolute bottom-0 left-0 top-0 my-auto h-5 w-[3px] rounded-full",
                      item.destructive ? "bg-rose-500" : "bg-slate-900 dark:bg-slate-100",
                    )}
                    transition={{ type: "spring", damping: 30, stiffness: 520, mass: 0.8 }}
                  />
                ) : null}
                <Icon className="relative z-10 size-4 shrink-0" />
                <span className="relative z-10 whitespace-nowrap">{item.label}</span>
              </motion.button>
            );
          })}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

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
        className={cn("h-9 pr-11 md:pr-14", active && "font-medium")}
      >
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
      </SidebarMenuButton>
      <button
        ref={actionButtonRef}
        type="button"
        onClick={openActions}
        aria-label="Project actions"
        aria-expanded={isActionsOpen}
        className="absolute right-1.5 top-1.5 z-20 flex size-6 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground opacity-100 border-1 ring-sidebar-ring transition-[opacity,background-color,color] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 md:opacity-0 md:group-hover/menu-item:opacity-100 md:group-focus-within/menu-item:opacity-100"
      >
        <MoreVertical className="size-4" />
      </button>
      {typeof document !== "undefined" ? createPortal(actionMenu, document.body) : null}
      <div className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 text-[10px] tabular-nums text-sidebar-foreground/40 transition-opacity group-hover/menu-item:opacity-0 group-focus-within/menu-item:opacity-0 group-data-[collapsible=icon]:hidden md:block">
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
              render={<Link href="/" prefetch={false} />}
              tooltip="Drawgle"
            >
              <span className="flex aspect-square size-9 items-center justify-center rounded-md bg-[var(--dg-surface-muted)] ring-1 ring-[var(--dg-border)] group-data-[collapsible=icon]:size-8 [&_svg]:!size-6 group-data-[collapsible=icon]:[&_svg]:!size-5">
                <AgentBall className="h-6 w-6" />
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
          className="mx-2 flex h-9 items-center justify-center gap-2 rounded-lg dg-button-primary hover:dg-button-primary px-3 text-sm font-medium text-sidebar-primary-foreground transition hover:opacity-90 group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0"
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
