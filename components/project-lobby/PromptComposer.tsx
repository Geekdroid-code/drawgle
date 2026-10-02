import { useRef, type RefObject } from "react";
import { ArrowRight, ImagePlus, Loader2, Smartphone } from "lucide-react";

import { CLIENT_ENTRY_IMAGE_TYPES } from "@/lib/client-entry-draft";
import { BriefAttachment } from "./BriefAttachment";
import { ReferenceModeControl } from "./ReferenceModeControl";
import type { ProjectBrief } from "./use-project-brief";
import styles from "./project-lobby.module.css";

export function PromptComposer({ brief, textareaRef }: { brief: ProjectBrief; textareaRef: RefObject<HTMLTextAreaElement | null> }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = brief.isRestoringDraft ? "Restoring your draft…" : brief.isReadingImage ? "Reading your reference…" : brief.isGeneratingDesign ? "Creating your project…" : null;
  return (
    <form className={styles.composerForm} data-has-attachment={Boolean(brief.image || brief.selectedStylePreset)} onSubmit={(event) => { event.preventDefault(); void brief.generateDesign(); }} aria-busy={brief.isBusy}>
      <div className={styles.composerShell}>
        <BriefAttachment brief={brief} />
        <div className={styles.composerSurface}>
          <textarea
            ref={textareaRef}
            aria-label="Describe the mobile app you want to design"
            aria-describedby={brief.error ? "project-brief-error project-brief-help" : "project-brief-help"}
            value={brief.prompt}
            onChange={(event) => brief.setPrompt(event.target.value)}
            readOnly={brief.isBusy}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault(); void brief.generateDesign();
              }
            }}
            placeholder="Describe your app idea. Who is it for, and what should it do?"
            className={styles.textarea}
          />
          <div className={styles.composerToolbar}>
            <div className={styles.tools}>
              <input ref={fileInputRef} type="file" accept={CLIENT_ENTRY_IMAGE_TYPES.join(",")} className="hidden" aria-label="Upload a reference image" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void brief.uploadImage(file);
                event.target.value = "";
              }} />
              {brief.image ? <ReferenceModeControl brief={brief} /> : (
                <button type="button" className={styles.referenceButton} disabled={brief.isBusy} onClick={() => fileInputRef.current?.click()} aria-label="Add reference" title="Attach a screenshot to recreate, or an image to inspire the style">
                  <ImagePlus className="size-4" /><span>Add reference</span>
                </button>
              )}
              <span className={styles.projectKind}><Smartphone className="size-3.5" /> Mobile app</span>
            </div>
            <button type="submit" disabled={!brief.isBriefReady || brief.isBusy} className={styles.submitButton}>
              <span>{brief.isGeneratingDesign ? "Creating…" : "Start project"}</span>
              <span className={styles.submitIcon} aria-hidden="true">{brief.isBusy ? <Loader2 className="size-3.5 motion-safe:animate-spin" /> : <ArrowRight className="size-3.5" />}</span>
            </button>
          </div>
        </div>
      </div>
      <div className={styles.composerHelp} id="project-brief-help">
        <span role="status">{status ?? "Start with a brief, a screenshot, or a little inspiration."}</span>
        <span className={styles.keyboardHint}><kbd>↵</kbd> to start <span>·</span> <kbd>shift ↵</kbd> for a new line</span>
      </div>
      {brief.error ? <p className={styles.error} id="project-brief-error" role="alert">{brief.error}</p> : null}
    </form>
  );
}
