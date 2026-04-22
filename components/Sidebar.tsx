"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Plus, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjects } from "@/hooks/use-projects";
import type { AuthenticatedUser, ProjectData } from "@/lib/types";

interface SidebarProps {
  user: AuthenticatedUser;
  onSignOut: () => void;
  currentProjectId?: string;
  initialProjects?: ProjectData[];
}

const DAY_IN_MS = 86_400_000;

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

export function Sidebar({ user, onSignOut, currentProjectId, initialProjects = [] }: SidebarProps) {
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

  return (
    <aside className="flex h-full min-h-0 w-[320px] flex-col overflow-hidden border-r border-black/8 bg-[#ece7dc] text-neutral-900">
      <div className="shrink-0 border-b border-black/8 px-5 py-5">
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
          className={`mt-5 h-10 w-full justify-start rounded-full px-4 text-sm font-medium ${
            currentProjectId
              ? "bg-white text-neutral-700 hover:bg-white/90"
              : "bg-neutral-950 text-white hover:bg-neutral-800"
          }`}
        >
          <Plus className="mr-2 h-4 w-4" />
          New project
        </Button>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            className="h-11 rounded-full border-black/10 bg-white pl-10 text-sm text-neutral-900 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 py-5">
        <div className="space-y-6 pr-1">
          {Object.entries(groupedProjects).map(([label, groupedItems]) => (
            <div key={label}>
              <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</div>
              <div className="mt-3 space-y-1.5">
                {groupedItems.map((project) => (
                  <ProjectItem
                    key={project.id}
                    id={project.id}
                    title={project.name}
                    prompt={project.prompt || "Start from the protected workspace prompt composer."}
                    date={new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    active={project.id === currentProjectId}
                  />
                ))}
              </div>
            </div>
          ))}

          {filteredProjects.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-black/10 bg-white/50 px-4 py-5 text-sm leading-6 text-neutral-500">
              {query.trim() ? "No projects match that search." : "No projects yet. Start the first one from this workspace."}
            </div>
          ) : null}

          {!currentProjectId ? (
            <div className="rounded-[24px] border border-black/8 bg-white/55 px-4 py-4 text-sm leading-6 text-neutral-600">
              New projects start here. The brief, design system, planning, and build kickoff stay inside this protected workspace.
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-black/8 px-5 py-4">
        <div className="flex items-center gap-3 rounded-[22px] bg-white/60 px-3 py-3">
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
      </div>
    </aside>
  );
}

function ProjectItem({
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
    <button
      type="button"
      onClick={() => router.push(`/project/${id}`)}
      className={`w-full rounded-[22px] border px-3 py-3 text-left transition ${
        active
          ? "border-black/15 bg-white"
          : "border-transparent bg-transparent hover:border-black/8 hover:bg-white/65"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-neutral-950">{title}</div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{prompt}</p>
        </div>
        <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
      </div>
      <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">{date}</div>
    </button>
  );
}