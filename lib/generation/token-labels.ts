import { RADIUS_CLASSES, SURFACE_ELEVATIONS } from "@/lib/generation/design-classes";
import type { ColorRole } from "@/lib/generation/user-color-roles";
import type { RadiusClass, SurfaceElevation } from "@/lib/types";

/**
 * What the token model says beside the tokens about the request it read: what the user's own words ask for, and
 * whether the design uses tints. A model reads a request in any language and tells "private jet" from "jet black";
 * a list of words does not. The code learns from these labels what the user decided, and guides the rest.
 *
 * The labels describe the request and are not tokens, so they are taken off before the tokens are kept.
 */

export type UserAsked = {
  /** The colour roles the user names a colour for. */
  colorRoles: ColorRole[];
  /** Whether the user names a font or a typeface. */
  fonts: boolean;
  /** The corner style the user asks for. */
  corners: RadiusClass | null;
  /** How the user wants cards to separate from the page. */
  depth: SurfaceElevation | null;
};

export type TokenLabels = {
  /** Null when the model did not say, so a caller falls back to its own reading of the request. */
  userAsked: UserAsked | null;
  /** Null when the model did not say. */
  tints: boolean | null;
};

const COLOR_ROLES: readonly ColorRole[] = ["background", "surface", "action", "text"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

// Exact names only: a model that writes "none" for "nothing asked" must not be read as asking for square corners.
const exactly = <Value extends string>(value: unknown, allowed: readonly Value[]): Value | null => {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (allowed as readonly string[]).includes(text) ? text as Value : null;
};

export function readTokenLabels(raw: unknown): TokenLabels {
  const meta = isRecord(raw) && isRecord(raw.meta) ? raw.meta : null;
  const asked = meta && isRecord(meta.userAsked) ? meta.userAsked : null;
  return {
    userAsked: asked
      ? {
          colorRoles: Array.isArray(asked.colorRoles)
            ? [...new Set(asked.colorRoles.flatMap((role) => exactly(role, COLOR_ROLES) ?? []))]
            : [],
          fonts: asked.fonts === true,
          corners: exactly(asked.corners, RADIUS_CLASSES),
          depth: exactly(asked.depth, SURFACE_ELEVATIONS),
        }
      : null,
    tints: typeof meta?.tints === "boolean" ? meta.tints : null,
  };
}

/** The model's answer without the labels. */
export function withoutTokenLabels(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.meta)) return raw;
  const { userAsked: _userAsked, tints: _tints, ...meta } = raw.meta;
  return { ...raw, meta };
}

/** Whether the user's words ask anything of the design: a colour, a font, a corner style or a depth. */
export const asksAnything = (asked: UserAsked) =>
  asked.colorRoles.length > 0 || asked.fonts || Boolean(asked.corners) || Boolean(asked.depth);
