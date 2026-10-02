import { ChevronDown } from "lucide-react";

import type { ProjectBrief } from "./use-project-brief";
import styles from "./brief-attachment.module.css";

const referenceModes = [
  { id: "recreate", label: "Image to UI", description: "Recreate the layout and structure of your screenshot." },
  { id: "style", label: "Style reference", description: "Take inspiration from its colors and mood, with a new layout." },
] as const;

export function ReferenceModeControl({ brief }: { brief: ProjectBrief }) {
  const activeMode = referenceModes.find((mode) => mode.id === brief.imageReferenceMode)!;
  return (
    <>
      <label className={styles.mode} title={activeMode.description}>
        <select value={brief.imageReferenceMode} disabled={brief.isBusy} aria-label="How to use your reference" aria-describedby="project-reference-description" onChange={(event) => {
          const mode = referenceModes.find((item) => item.id === event.target.value);
          if (mode) brief.setImageReferenceMode(mode.id);
        }}>
          {referenceModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
        </select>
        <ChevronDown className="size-3" aria-hidden="true" />
      </label>
      <p id="project-reference-description" className="sr-only">{activeMode.description}</p>
    </>
  );
}
