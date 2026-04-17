"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { CanvasArea } from "@/components/CanvasArea";
import { PromptBar } from "@/components/PromptBar";
import { ScreenEditorPanel } from "@/components/ScreenEditorPanel";
import { ArtDirectorPanel } from "@/components/ArtDirectorPanel";
import { auth, logOut, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Loader2, ArrowLeft } from "lucide-react";
import { ScreenData, ProjectData } from "@/lib/types";
import { runGenerationPipeline } from "@/lib/generation";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  const [centerTarget, setCenterTarget] = useState<{x: number, y: number, timestamp: number} | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(null);
  
  // Stores prompt and image payload for when the UI waits for Art Director configuration
  const [pendingGenOptions, setPendingGenOptions] = useState<{ prompt: string, image?: any, startX: number, startY: number } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) router.push("/");
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user || !projectId) return;

    const unsubscribe = onSnapshot(doc(db, "projects", projectId), (docSnap) => {
      if (docSnap.exists()) {
        setProject(docSnap.data() as ProjectData);
      } else {
        router.push("/"); // Project not found
      }
      setIsProjectLoading(false);
    });

    return () => unsubscribe();
  }, [user, projectId, router]);

  const handlePromptSubmit = async (options: { prompt: string, image: any, startX: number, startY: number, needsDesign: boolean }) => {
     if (options.needsDesign) {
        setPendingGenOptions(options); 
        // Note: tokens are fetched inside ArtDirectorPanel now, or we can fetch them here.
        // Actually, let's keep the fetch logic in ArtDirectorPanel. 
        // We just save the project state to 'draft' and update the prompt, 
        // which triggers ArtDirectorPanel to mount and fetch the design.
        await updateDoc(doc(db, "projects", projectId), {
          prompt: options.prompt,
          status: "draft"
        });
     } else {
        // Normal direct generation
        await runGenerationPipeline({
           prompt: options.prompt,
           image: options.image,
           designTokens: project?.designTokens,
           projectId,
           userId: user!.uid,
           startX: options.startX,
           startY: options.startY
        });
     }
  };

  const handleGenerationStart = async (tokens: any) => {
    if (!user || !project) return;
    
    const opts = pendingGenOptions || { prompt: project.prompt || "", startX: 4800, startY: 4600 };
    
    // We update the project doc to active and kick off the build
    await runGenerationPipeline({
      prompt: opts.prompt,
      image: opts.image,
      projectId,
      userId: user.uid,
      designTokens: tokens,
      startX: opts.startX,
      startY: opts.startY
    });
    
    setPendingGenOptions(null);
  };

  if (!isAuthReady || !user || isProjectLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#f5f5f5]"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  if (!project) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f5] text-gray-900 font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full shrink-0">
        <Sidebar user={user} onSignOut={logOut} currentProjectId={projectId} />
      </div>

      <main className="flex-1 relative flex h-full w-full overflow-hidden z-0">
        {/* Mobile Header */}
        <div className="md:hidden absolute top-4 left-4 z-50 flex items-center gap-2">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" className="bg-white/90 backdrop-blur-md shadow-sm border-gray-200" />}>
              <Menu className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <Sidebar user={user} onSignOut={logOut} currentProjectId={projectId} />
            </SheetContent>
          </Sheet>
          <Button variant="outline" size="sm" onClick={() => router.push('/')} className="bg-white/90 backdrop-blur-md shadow-sm border-gray-200">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>

        {/* Desktop Back to Dashboard */}
        <div className="hidden md:block absolute top-4 left-4 z-50">
          <Button variant="outline" size="sm" onClick={() => router.push('/')} className="bg-white/90 backdrop-blur-md shadow-sm border-gray-200">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>

        {/* Dynamic Workflow Layer */}
        {/* Normal Canvas Area is always visible */}
        <div className="flex-1 h-full relative min-w-0">
          <CanvasArea 
            projectId={projectId}
            centerTarget={centerTarget} 
            selectedScreen={selectedScreen} 
            onSelectScreen={setSelectedScreen} 
          />
          
          {/* Bottom PromptBar for NEW generations (hidden when editing) */}
          {!selectedScreen && (
            <div className={`absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 transition-all duration-300 ${project.status === 'draft' ? 'opacity-0 pointer-events-none translate-y-8' : 'opacity-100 translate-y-0'}`}>
              <PromptBar 
                projectId={projectId}
                project={project}
                onSubmit={handlePromptSubmit}
                onGenerate={(x, y) => setCenterTarget({ x, y, timestamp: Date.now() } as any)} 
              />
            </div>
          )}

          {/* Editor Panel (Floating) */}
          {selectedScreen && (
            <ScreenEditorPanel 
              screen={selectedScreen} 
              onClose={() => setSelectedScreen(null)} 
            />
          )}

          {/* Art Director Overlay */}
          {project.status === "draft" && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-6 pb-20">
              <ArtDirectorPanel project={project} onGenerationStart={handleGenerationStart} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
