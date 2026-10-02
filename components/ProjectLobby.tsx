"use client";

import { useRef } from "react";

import { DrawgleLogo } from "@/components/DrawgleLogo";
import { PromptComposer } from "@/components/project-lobby/PromptComposer";
import { StarterDirections } from "@/components/project-lobby/StarterDirections";
import { useProjectBrief, type ProjectBriefOptions } from "@/components/project-lobby/use-project-brief";
import type { AuthenticatedUser, ProjectData } from "@/lib/types";
import styles from "@/components/project-lobby/project-lobby.module.css";

export function ProjectLobby({ className = "", ...options }: ProjectBriefOptions & {
  user: AuthenticatedUser;
  initialProjects: ProjectData[];
  className?: string;
}) {
  const brief = useProjectBrief(options);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return (
    <main className={`${styles.lobby} ${className}`}>
      <div className={styles.studio}>
        <div className={styles.intro}>
          <div className={styles.studioLabel}><DrawgleLogo className="size-3.5" /> Your design studio</div>
          <h1>What are we<br /><span>bringing to life?</span></h1>
          <p>Describe your mobile app, or start with a design you love.</p>
        </div>
        <PromptComposer brief={brief} textareaRef={textareaRef} />
        <StarterDirections selectedSlug={brief.selectedStylePreset?.slug} disabled={brief.isBusy} onSelect={(collection) => {
          brief.selectDirection(collection);
          textareaRef.current?.focus({ preventScroll: true });
        }} />
      </div>
    </main>
  );
}
