import type { PromptImagePayload } from "@/lib/types";

const DATABASE_NAME = "drawgle-client-drafts";
const DATABASE_VERSION = 1;
const STORE_NAME = "entry-drafts";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export const CLIENT_ENTRY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const CLIENT_ENTRY_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

type ClientEntryDraftImage = {
  blob: Blob;
  name: string;
};

export type ClientEntryDraft = {
  id: string;
  prompt: string;
  image: ClientEntryDraftImage | null;
  createdAt: number;
  expiresAt: number;
};

const isSupportedDraftId = (draftId: string) => /^[a-zA-Z0-9-]{1,100}$/.test(draftId);

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Browser draft storage is unavailable."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open browser draft storage."));
  });
}

async function runDraftRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDraftDatabase();

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Browser draft storage failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Browser draft storage was interrupted."));
    });
  } finally {
    database.close();
  }
}

export function validateClientEntryImage(file: File) {
  if (!CLIENT_ENTRY_IMAGE_TYPES.includes(file.type as (typeof CLIENT_ENTRY_IMAGE_TYPES)[number])) {
    return "Use a PNG, JPEG, WebP, or GIF image.";
  }

  if (file.size > CLIENT_ENTRY_IMAGE_MAX_BYTES) {
    return "Image must be 8MB or smaller.";
  }

  return null;
}

export async function saveClientEntryDraft({ prompt, image }: { prompt: string; image: File | null }) {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const draft: ClientEntryDraft = {
    id,
    prompt,
    image: image ? { blob: image, name: image.name } : null,
    createdAt,
    expiresAt: createdAt + DRAFT_TTL_MS,
  };

  await runDraftRequest("readwrite", (store) => store.put(draft));
  return id;
}

export async function readClientEntryDraft(draftId: string) {
  if (!isSupportedDraftId(draftId)) {
    return null;
  }

  const draft = await runDraftRequest<ClientEntryDraft | undefined>("readonly", (store) => store.get(draftId));
  if (!draft) {
    return null;
  }

  if (draft.expiresAt <= Date.now()) {
    await runDraftRequest("readwrite", (store) => store.delete(draftId));
    return null;
  }

  return draft;
}

export function draftImageToPromptPayload(image: ClientEntryDraftImage) {
  return new Promise<PromptImagePayload>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read the saved reference image."));
        return;
      }

      const commaIndex = reader.result.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("The saved reference image is invalid."));
        return;
      }

      resolve({
        data: reader.result.slice(commaIndex + 1),
        mimeType: image.blob.type || "application/octet-stream",
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the saved reference image."));
    reader.readAsDataURL(image.blob);
  });
}
