"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Code, LayoutGrid, Loader2, LogOut, Plus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjects } from "@/hooks/use-projects";
import { createClient } from "@/lib/supabase/client";
import { createProject } from "@/lib/supabase/queries";
import type { AuthenticatedUser, ProjectData } from "@/lib/types";

export function DashboardShell({
  user,
  initialProjects,
}: {
  user: AuthenticatedUser;
  initialProjects: ProjectData[];
}) {
  const router = useRouter();
  const { projects } = useProjects(user.id, initialProjects);
  const [isCreating, setIsCreating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [newProjectPrompt, setNewProjectPrompt] = useState("");

  const handleCreateProject = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!newProjectPrompt.trim() || isCreating) {
      return;
    }

    setIsCreating(true);

    try {
      const supabase = createClient();
      const project = await createProject(supabase, {
        ownerId: user.id,
        name: newProjectPrompt.trim(),
        prompt: "",
        status: "active",
      });

      router.push(`/project/${project.id}`);
    } catch (error) {
      console.error("Failed to create project", error);
      setIsCreating(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await fetch("/auth/signout", {
        method: "POST",
      });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out", error);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-black p-1.5 text-white">
            <Code className="h-5 w-5" />
          </div>
          <span className="hidden text-xl font-bold tracking-tight sm:inline-block">Drawgle</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback>{user.fullName?.charAt(0) ?? user.email?.charAt(0) ?? "U"}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-gray-700">{user.fullName ?? user.email ?? "Signed in"}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-gray-500 hover:text-gray-900"
            disabled={isSigningOut}
          >
            {isSigningOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-16 space-y-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">What are you building today?</h1>

          <form
            onSubmit={handleCreateProject}
            className="group relative mx-auto flex max-w-2xl items-center rounded-full border border-gray-200 bg-white p-2 shadow-lg transition-all focus-within:ring-2 focus-within:ring-black/5"
          >
            <Input
              value={newProjectPrompt}
              onChange={(event) => setNewProjectPrompt(event.target.value)}
              placeholder="A dark-mode crypto portfolio tracker..."
              className="h-12 flex-1 rounded-l-full border-0 bg-transparent px-6 text-lg shadow-none focus-visible:ring-0"
              disabled={isCreating}
            />
            <Button type="submit" className="h-12 rounded-full px-8 font-medium" disabled={isCreating || !newProjectPrompt.trim()}>
              {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Start Project"}
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900">
              <LayoutGrid className="h-5 w-5 text-gray-400" />
              Recent Projects
            </h2>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white/50 py-20 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mb-1 text-lg font-medium text-gray-900">No projects yet</h3>
              <p className="text-gray-500">Create your first project using the search bar above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                >
                  <div className="mb-4 flex h-32 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-300 transition-colors group-hover:bg-gray-100">
                    <LayoutGrid className="h-10 w-10 opacity-50" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="truncate text-lg font-semibold text-gray-900">{project.name}</h3>
                    <p className="line-clamp-2 text-sm text-gray-500" title={project.prompt}>
                      &quot;{project.prompt || "Start from the prompt bar inside the project."}&quot;
                    </p>
                    <div className="flex items-center gap-1.5 pt-2 text-xs font-medium text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}