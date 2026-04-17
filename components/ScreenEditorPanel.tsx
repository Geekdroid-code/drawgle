"use client";

import { useState, useEffect, useRef } from "react";
import { ScreenData } from "@/lib/types";
import { db, auth, handleFirestoreError, OperationType } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, X, MessageSquare, Trash2, ChevronDown } from "lucide-react";
import { applyEdits } from "@/lib/diff-engine";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export function ScreenEditorPanel({
  screen,
  onClose
}: {
  screen: ScreenData;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-expand on desktop, collapse on mobile
    setIsExpanded(window.innerWidth >= 768);
  }, [screen.id]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "screens", screen.id, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages: Message[] = [];
      snapshot.forEach((doc) => {
        newMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(newMessages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `screens/${screen.id}/messages`);
    });

    return () => unsubscribe();
  }, [screen.id]);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "screens", screen.id));
      onClose();
    } catch (error) {
      console.error("Error deleting screen:", error);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() || isGenerating || !auth.currentUser) return;

    const userMessageContent = prompt.trim();
    setPrompt("");
    setIsGenerating(true);
    
    // Auto expand when sending a message to see the response
    if (!isExpanded) setIsExpanded(true);

    try {
      // 1. Save user message
      await addDoc(collection(db, "screens", screen.id, "messages"), {
        role: "user",
        content: userMessageContent,
        timestamp: new Date().toISOString()
      });

      // 2. Prepare AI request
      const editRes = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessageContent }],
          screenCode: screen.code
        })
      });

      if (!editRes.ok) throw new Error("Failed to edit screen");
      if (!editRes.body) throw new Error("No response body");

      const reader = editRes.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        fullResponse += decoder.decode(value, { stream: true });
      }

      // 3. Save AI message
      await addDoc(collection(db, "screens", screen.id, "messages"), {
        role: "model",
        content: fullResponse,
        timestamp: new Date().toISOString()
      });

      // 4. Apply edits
      if (fullResponse.includes("<edit>")) {
        const newCode = applyEdits(screen.code, fullResponse);
        
        if (newCode !== screen.code) {
          await setDoc(doc(db, "screens", screen.id), {
            code: newCode,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }

    } catch (error) {
      console.error("Edit error:", error);
      // Optionally add an error message to the chat
      await addDoc(collection(db, "screens", screen.id, "messages"), {
        role: "model",
        content: "Sorry, I encountered an error while trying to apply those changes.",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isExpanded) {
    return (
      <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-t-xl border-b border-blue-100 mb-1 -mx-2 -mt-2">
            <span className="text-xs font-medium text-blue-700 truncate max-w-[200px] md:max-w-md">
              Editing: {screen.name}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-full" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-full" onClick={onClose}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          
          <Textarea 
            placeholder="How should we modify this screen?"
            className="min-h-[80px] resize-none border-none focus-visible:ring-0 text-base bg-transparent px-3 py-2"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 rounded-full" onClick={() => setIsExpanded(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              {messages.length} messages
            </Button>
            <Button 
              size="icon" 
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSend}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div className="md:hidden fixed inset-0 bg-black/20 z-40" onClick={() => setIsExpanded(false)} />
      
      <div className={`absolute z-50 flex flex-col bg-white shadow-2xl overflow-hidden transition-all duration-300
        md:right-4 md:top-4 md:bottom-4 md:w-96 md:rounded-2xl md:border md:border-gray-200
        bottom-0 left-0 right-0 h-[85vh] rounded-t-3xl border-t border-gray-200
      `}>
        <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-sm text-gray-900 truncate max-w-[180px]">{screen.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)} className="h-8 w-8 rounded-full hover:bg-gray-100 md:hidden">
              <ChevronDown className="w-5 h-5 text-gray-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-gray-100 hidden md:flex">
              <X className="w-4 h-4 text-gray-500" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50/50">
          {messages.length === 0 && (
            <div className="text-center text-sm text-gray-500 mt-10">
              No history yet. Ask me to change colors, layout, or add new elements!
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col max-w-[90%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
              <div className={`px-3 py-2 rounded-2xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-sm' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
              }`}>
                {msg.role === 'model' && msg.content.includes('<edit>') ? (
                  <div className="flex items-center gap-2 text-green-600 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    Applied changes
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="self-start px-3 py-2 rounded-2xl bg-white border border-gray-200 shadow-sm rounded-tl-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-500">Working on it...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-white border-t border-gray-100 shrink-0">
          <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <Textarea 
              placeholder="Make the button blue..."
              className="min-h-[40px] max-h-[120px] resize-none border-none focus-visible:ring-0 text-sm bg-transparent px-3 py-2"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button 
              size="icon" 
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white h-8 w-8 shrink-0 mb-1 mr-1"
              onClick={handleSend}
              disabled={isGenerating || !prompt.trim()}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
