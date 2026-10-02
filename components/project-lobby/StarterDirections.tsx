"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import type { CSSProperties } from "react";

import { getStylePresetSlug, showcaseCollections, type ShowcaseCollection } from "@/lib/showcase";

import styles from "./starter-directions.module.css";

const directionOptions = [
  { id: "minimal-habit-premium", caption: "Calm, considered routines." },
  { id: "neo-mint", caption: "Bold finance. Clear focus." },
  { id: "food-delivery", caption: "Warm, effortless discovery." },
].flatMap(({ id, caption }) => {
  const collection = showcaseCollections.find((item) => item.id === id);
  return collection ? [{ collection, caption }] : [];
});

type StarterDirectionsProps = {
  onSelect: (collection: ShowcaseCollection) => void;
  selectedSlug?: string | null;
  disabled?: boolean;
};

export function StarterDirections({ onSelect, selectedSlug, disabled = false }: StarterDirectionsProps) {
  return (
    <section className={styles.section} aria-labelledby="starter-directions-heading">
      <div className={styles.header}>
        <h2 id="starter-directions-heading">A little inspiration</h2>
        <Link
          href="/showcase"
          className={styles.explore}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : undefined}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          Explore designs <ArrowUpRight aria-hidden="true" size={13} />
        </Link>
      </div>

      <div className={styles.tray}>
        {directionOptions.map(({ collection, caption }) => {
          const selected = selectedSlug === getStylePresetSlug(collection);

          return (
            <button
              key={collection.id}
              type="button"
              onClick={() => onSelect(collection)}
              disabled={disabled}
              aria-pressed={selected}
              className={styles.card}
              style={{ "--direction-color": collection.palette[2] ?? collection.palette[0] } as CSSProperties}
            >
              <span className={styles.copy}>
                <span className={styles.title}>{collection.name}</span>
                <span className={styles.caption}>{caption}</span>
              </span>

              <span className={styles.palette} aria-hidden="true">
                {collection.palette.slice(0, 3).map((color) => (
                  <span key={color} style={{ backgroundColor: color }} />
                ))}
              </span>

              <span className={styles.previews} aria-hidden="true">
                {collection.screens.slice(0, 2).map((screen) => (
                  <span key={screen.id} className={styles.phone}>
                    <Image src={screen.screenshot} alt="" fill sizes="54px" className={styles.screen} />
                  </span>
                ))}
              </span>

              {selected ? (
                <span className={styles.selected} aria-hidden="true">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
