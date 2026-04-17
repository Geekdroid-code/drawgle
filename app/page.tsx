"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, signInWithGoogle, db, handleFirestoreError, OperationType, logOut } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, onSnapshot, setDoc, doc, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, LayoutGrid, LogOut, Code, Clock } from "lucide-react";
import { ProjectData } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectPrompt, setNewProjectPrompt] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "projects"),
      where("userId", "==", user.uid)
    );
    
    // orderBy("createdAt", "desc") requires composite index if combined with where, 
    // so we'll sort client-side for now to avoid manual index creation interruption.

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs: ProjectData[] = [];
      snapshot.forEach(doc => {
        projs.push(doc.data() as ProjectData);
      });
      // Sort newest first
      projs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setProjects(projs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "projects");
    });
    return () => unsubscribe();
  }, [user]);

  const handleCreateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !newProjectPrompt.trim()) return;

    setIsCreating(true);
    try {
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newProject: ProjectData = {
        id: projectId,
        userId: user.uid,
        name: newProjectPrompt, // The user input acts as Name initially
        prompt: "", // Prompt is empty, to be filled in the Canvas PromptBar
        status: 'active', // Immediately active so Canvas shows
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "projects", projectId), newProject);
      router.push(`/project/${projectId}`);
    } catch (error) {
      console.error(error);
      setIsCreating(false);
    }
  };

  if (!isAuthReady) {
    return <div className="flex h-screen items-center justify-center bg-[#f5f5f5]"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-6 max-w-sm px-4">
          <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Code className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Stitch AI</h1>
          <p className="text-gray-500 text-lg">Generate mobile interfaces directly onto an infinite canvas.</p>
          <Button onClick={signInWithGoogle} size="lg" className="w-full text-md py-6 shadow-md hover:shadow-lg transition-all">
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-black text-white p-1.5 rounded-lg">
            <Code className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:inline-block">Stitch</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 mr-4">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-gray-700">{user.displayName}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logOut} className="text-gray-500 hover:text-gray-900">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-16 space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">What are you building today?</h1>
          
          <form onSubmit={handleCreateProject} className="max-w-2xl mx-auto relative flex items-center shadow-lg rounded-full bg-white p-2 border border-gray-200 group focus-within:ring-2 focus-within:ring-black/5 transition-all">
            <Input 
              value={newProjectPrompt}
              onChange={(e) => setNewProjectPrompt(e.target.value)}
              placeholder="A dark-mode crypto portfolio tracker..." 
              className="flex-1 border-0 focus-visible:ring-0 text-lg px-6 h-12 shadow-none rounded-l-full bg-transparent"
              disabled={isCreating}
            />
            <Button 
              type="submit" 
              className="rounded-full px-8 h-12 font-medium"
              disabled={isCreating || !newProjectPrompt.trim()}
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Project'}
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-gray-400" />
              Recent Projects
            </h2>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
              <div className="inline-flex w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No projects yet</h3>
              <p className="text-gray-500">Create your first project using the search bar above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div 
                  key={project.id} 
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="group cursor-pointer bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all text-left"
                >
                  <div className="h-32 mb-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-gray-300 group-hover:bg-gray-100 transition-colors">
                    {/* Placeholder for project thumbnail */}
                    <LayoutGrid className="w-10 h-10 opacity-50" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg text-gray-900 truncate">{project.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2" title={project.prompt}>
                      &quot;{project.prompt}&quot;
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium pt-2">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
