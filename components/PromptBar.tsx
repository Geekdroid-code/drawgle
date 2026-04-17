import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Image as ImageIcon, Send, Loader2, X } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, getDocs, where } from "firebase/firestore";
import { ProjectData } from "@/lib/types";

export function PromptBar({ 
  onSubmit,
  onGenerate,
  project,
  projectId
}: { 
  onSubmit?: (options: { prompt: string, image: any, startX: number, startY: number, needsDesign: boolean }) => Promise<void>,
  onGenerate?: (x: number, y: number) => void,
  project?: ProjectData,
  projectId: string
}) {
  // Pre-fill prompt if project prompt exists but we're starting a new project canvas session
  const [prompt, setPrompt] = useState(project?.prompt || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [image, setImage] = useState<{ data: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      setImage({ data: base64Data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if ((!prompt.trim() && !image) || !auth.currentUser) return;

    setIsGenerating(true);
    // Determine if we need to kick off design tokens (true if they are completely missing)
    const needsDesign = !project?.designTokens;
    setAgentStatus(needsDesign ? "Requesting Art Director..." : "Planning screens...");
    
    let startX = 4800;
    let startY = 4600;

    try {
      const q = query(
        collection(db, "screens"), 
        where("userId", "==", auth.currentUser.uid),
        where("projectId", "==", projectId)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        let maxX = -Infinity;
        let maxY = -Infinity;
        snapshot.forEach(doc => {
          const data = doc.data();
          if (typeof data.x === 'number' && data.x > maxX) maxX = data.x;
          if (typeof data.y === 'number' && data.y > maxY) maxY = data.y;
        });
        if (maxX !== -Infinity) {
          startX = maxX + 450; // Place to the right of the rightmost existing screen
          startY = maxY !== -Infinity ? maxY : 4600; // Align with the bottom-most screen
        }
      }
    } catch (e) {
      console.error("Error fetching existing screens for positioning", e);
    }
    
    if (onGenerate) {
      onGenerate(startX, startY);
    }
    
    try {
      if (onSubmit) {
         await onSubmit({ prompt, image, startX, startY, needsDesign });
      }
      if (!needsDesign) {
         // Only clearing if we're not heading into ArtDirector popup
         setPrompt("");
         setImage(null);
      }
    } catch (error: any) {
      console.error("Pipeline error:", error);
      alert("Failed to process the request. Please try again.");
    } finally {
      setIsGenerating(false);
      setAgentStatus("");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-2 flex flex-col gap-2 relative">
      {isGenerating && agentStatus && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
          <Loader2 className="w-3 h-3 animate-spin" />
          {agentStatus}
        </div>
      )}
      {image && (
        <div className="px-3 pt-2 relative inline-block">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
            <img src={`data:${image.mimeType};base64,${image.data}`} alt="Upload" className="w-full h-full object-cover" />
            <button 
              onClick={() => setImage(null)}
              className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      <Textarea 
        placeholder="What native mobile app shall we design?"
        className="min-h-[80px] resize-none border-none focus-visible:ring-0 text-base bg-transparent px-3 py-2"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
          }
        }}
      />
      <div className="flex items-center justify-between px-2 pb-1">
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full text-gray-500 hover:text-gray-900"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1.5">
            <span className="text-xs font-medium text-gray-600">App</span>
            <span className="text-xs font-medium text-gray-400 px-2 border-l border-gray-300 ml-1">Web</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
            <Sparkles className="w-4 h-4 text-gray-600" />
            <span className="text-xs font-medium text-gray-600">3.1 Flash</span>
          </div>
          <Button 
            size="icon" 
            className="rounded-full bg-gray-900 hover:bg-gray-800 text-white"
            onClick={handleGenerate}
            disabled={isGenerating || (!prompt.trim() && !image)}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
