import Image from "next/image";
import { Palette, X } from "lucide-react";

import { getStylePresetSlug, showcaseCollections } from "@/lib/showcase";
import type { ProjectBrief } from "./use-project-brief";
import styles from "./brief-attachment.module.css";

export function BriefAttachment({ brief }: { brief: ProjectBrief }) {
  const { image, imageName, selectedStylePreset, isBusy } = brief;
  if (!image && !selectedStylePreset) return null;
  const collection = selectedStylePreset ? showcaseCollections.find((item) => getStylePresetSlug(item) === selectedStylePreset.slug) : null;

  return (
    <div className={styles.dock}>
      <div className={styles.pin} title={image ? imageName : selectedStylePreset?.description}>
        {image ? (
          <span className={styles.imageFrame}>
            <span className={styles.imageSlot}><Image src={`data:${image.mimeType};base64,${image.data}`} alt="Attached reference preview" fill unoptimized /></span>
          </span>
        ) : collection ? (
          <span className={styles.fan} aria-hidden="true">
            {collection.screens.slice(0, 2).map((screen) => (
              <span key={screen.id} className={styles.phone}><Image src={screen.screenshot} alt="" fill sizes="39px" className="object-cover object-top" /></span>
            ))}
          </span>
        ) : <span className={styles.fallback}><Palette className="size-5" /></span>}
        <button type="button" onClick={image ? brief.removeImage : brief.clearStylePreset} disabled={isBusy} className={styles.remove} aria-label={image ? "Remove reference image" : "Remove curated style"}><X className="size-3" /></button>
      </div>
      {!image ? (
        <div className={styles.meta}>
          <span className={styles.styleTitle}>{selectedStylePreset?.title}</span>
          <span className={styles.palette}>
            {collection?.palette.slice(0, 3).map((color) => <i key={color} style={{ backgroundColor: color }} aria-hidden="true" />)}
            <span>Style direction</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
