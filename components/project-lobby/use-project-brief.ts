"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { draftImageToPromptPayload, readClientEntryDraft, validateClientEntryImage } from "@/lib/client-entry-draft";
import { getStylePresetSlug, type ShowcaseCollection } from "@/lib/showcase";
import type { ImageReferenceMode, PromptImagePayload } from "@/lib/types";

export type LobbyStylePreset = { slug: string; version: number; title: string; description: string };
export type ProjectBriefOptions = {
  initialPrompt?: string;
  initialClientDraftId?: string;
  initialStylePreset?: LobbyStylePreset | null;
};

export function useProjectBrief({ initialPrompt = "", initialClientDraftId, initialStylePreset = null }: ProjectBriefOptions) {
  const router = useRouter();
  const restoredClientDraft = useRef(false);
  const creationRequestId = useRef<string | null>(null);
  const submissionInFlight = useRef(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [image, setImage] = useState<PromptImagePayload | null>(null);
  const [imageName, setImageName] = useState("Reference image");
  const [imageReferenceMode, setImageReferenceMode] = useState<ImageReferenceMode>("recreate");
  const [selectedStylePreset, setSelectedStylePreset] = useState(initialStylePreset);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingDesign, setIsGeneratingDesign] = useState(false);
  const [isRestoringDraft, setIsRestoringDraft] = useState(Boolean(initialClientDraftId));
  const [isReadingImage, setIsReadingImage] = useState(false);

  useEffect(() => {
    if (!initialClientDraftId || restoredClientDraft.current) return;
    restoredClientDraft.current = true;
    void (async () => {
      try {
        const draft = await readClientEntryDraft(initialClientDraftId);
        if (!draft) {
          setError("Your saved homepage draft expired or is no longer available. You can enter it again here.");
          return;
        }
        const restoredImage = draft.image ? await draftImageToPromptPayload(draft.image) : null;
        setPrompt(draft.prompt);
        if (restoredImage && draft.image) {
          setImage(restoredImage);
          setImageName(draft.image.name);
          setSelectedStylePreset(null);
        }
      } catch (restoreError) {
        console.error("Failed to restore homepage draft", restoreError);
        setError("Could not restore the saved homepage draft. You can enter it again here.");
      } finally {
        setIsRestoringDraft(false);
      }
    })();
  }, [initialClientDraftId]);

  const isBusy = isGeneratingDesign || isRestoringDraft || isReadingImage;
  const isBriefReady = Boolean(prompt.trim() || image);
  const uploadImage = async (file: File) => {
    if (isBusy) return;
    const validationError = validateClientEntryImage(file);
    if (validationError) { setError(validationError); return; }
    setError(null);
    setIsReadingImage(true);
    try {
      const payload = await draftImageToPromptPayload({ blob: file, name: file.name });
      setImage(payload);
      setImageName(file.name);
      setSelectedStylePreset(null);
    } catch {
      setError("Could not read this image. Please try attaching it again.");
    } finally { setIsReadingImage(false); }
  };

  const removeImage = () => { setImage(null); setImageReferenceMode("recreate"); };
  const selectDirection = (collection: ShowcaseCollection) => {
    if (isBusy) return;
    setPrompt(collection.prompt);
    setSelectedStylePreset({ slug: getStylePresetSlug(collection), version: 1, title: collection.name, description: collection.description });
    removeImage();
    setError(null);
  };

  const generateDesign = async () => {
    if (!isBriefReady || isBusy || submissionInFlight.current) return;
    submissionInFlight.current = true;
    setError(null);
    setIsGeneratingDesign(true);
    try {
      creationRequestId.current ??= crypto.randomUUID();
      const response = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: creationRequestId.current, prompt: prompt.trim(), image,
          imageReferenceMode: image ? imageReferenceMode : "style",
          stylePresetSlug: !image ? selectedStylePreset?.slug ?? null : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.projectId) throw new Error(typeof payload.error === "string" ? payload.error : "Could not create your project.");
      router.push(`/project/${payload.projectId}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create your project.");
      setIsGeneratingDesign(false);
      submissionInFlight.current = false;
    }
  };

  return {
    prompt, setPrompt, image, imageName, imageReferenceMode, setImageReferenceMode,
    selectedStylePreset, clearStylePreset: () => setSelectedStylePreset(null),
    error, isBusy, isBriefReady, isGeneratingDesign, isRestoringDraft, isReadingImage,
    uploadImage, removeImage, selectDirection, generateDesign,
  };
}

export type ProjectBrief = ReturnType<typeof useProjectBrief>;
