"use client";

import { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutGrid, Users, Search, LogOut, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ProjectData } from "@/lib/types";

interface SidebarProps {
  user: User;
  onSignOut: () => void;
  currentProjectId?: string;
}

export function Sidebar({ user, onSignOut, currentProjectId }: SidebarProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectData[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "projects"),
      where("userId", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs: ProjectData[] = [];
      snapshot.forEach(doc => {
        projs.push(doc.data() as ProjectData);
      });
      projs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setProjects(projs);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="w-64 bg-[#f0f0f0] border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
          <div className="bg-black text-white p-1 rounded">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg tracking-tight">Stitch</span>
        </div>
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user.photoURL || ""} />
            <AvatarFallback>{user.displayName?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Projects</h3>
            <div className="space-y-1">
              {projects.map(proj => (
                <ProjectItem 
                  key={proj.id}
                  id={proj.id}
                  title={proj.name} 
                  date={new Date(proj.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} 
                  active={proj.id === currentProjectId} 
                />
              ))}
              {projects.length === 0 && (
                <div className="text-sm text-gray-500 pt-2">No projects yet.</div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-gray-200">
        <Button variant="ghost" className="w-full justify-start text-gray-500 hover:text-gray-900" onClick={onSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function ProjectItem({ id, title, date, active = false }: { id: string, title: string, date: string, active?: boolean }) {
  const router = useRouter();
  return (
    <button onClick={() => router.push(`/project/${id}`)} className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${active ? 'bg-gray-200' : 'hover:bg-gray-200/50'}`}>
      <div className="font-medium text-sm truncate">{title}</div>
      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
        <LayoutGrid className="w-3 h-3" />
        {date}
      </div>
    </button>
  );
}
