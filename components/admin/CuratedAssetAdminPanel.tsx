"use client";

import { type ChangeEvent, type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Image as ImageIcon, Loader2, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VisualAssetRole, VisualAssetType } from "@/lib/types";

type UploadStatus = "ready" | "uploading" | "uploaded" | "failed";

type UploadedAssetResult = {
  id: string;
  displayUrl: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  hasAlpha: boolean;
};

type AssetDraft = {
  id: string;
  file: File;
  previewUrl: string;
  subject: string;
  role: VisualAssetRole;
  assetType: VisualAssetType;
  hasAlpha: boolean;
  tags: string;
  reuseKey: string;
  license: string;
  status: UploadStatus;
  error: string | null;
  result: UploadedAssetResult | null;
};

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const roleOptions: Array<{ value: VisualAssetRole; label: string }> = [
  { value: "hero_cutout", label: "Hero cutout" },
  { value: "product_cutout", label: "Product cutout" },
  { value: "avatar", label: "Avatar" },
  { value: "section_photo", label: "Section photo" },
  { value: "background_photo", label: "Background photo" },
  { value: "product_photo", label: "Product photo" },
  { value: "decorative_object", label: "Decorative object" },
  { value: "map_texture", label: "Map texture" },
];

const assetTypeOptions: Array<{ value: VisualAssetType; label: string }> = [
  { value: "transparent_png", label: "Transparent PNG" },
  { value: "photo", label: "Photo" },
  { value: "illustration", label: "Illustration" },
  { value: "icon_like", label: "Icon-like" },
];

const isAllowedImage = (file: File) => ["image/png", "image/jpeg", "image/webp"].includes(file.type);

const titleFromFilename = (name: string) => {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  const words = withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return words || "Curated asset";
};

const defaultRoleForFile = (file: File): VisualAssetRole => {
  const name = file.name.toLowerCase();
  if (/\b(avatar|profile|face|portrait)\b/.test(name)) return "avatar";
  if (/\b(photo|background|hero-bg|scene)\b/.test(name)) return "section_photo";
  if (/\b(map|route|tracking)\b/.test(name)) return "map_texture";
  if (/\b(product|shoe|sneaker|bag|watch|bottle|pack|object)\b/.test(name)) return "product_cutout";
  return "hero_cutout";
};

const defaultAssetTypeForFile = (file: File): VisualAssetType => {
  if (file.type === "image/jpeg") return "photo";
  return "transparent_png";
};

const createDraft = (file: File): AssetDraft => {
  const role = defaultRoleForFile(file);
  const assetType = defaultAssetTypeForFile(file);
  const subject = titleFromFilename(file.name);

  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    subject,
    role,
    assetType,
    hasAlpha: file.type === "image/png" || file.type === "image/webp",
    tags: [
      role.replace(/_/g, " "),
      subject.toLowerCase(),
    ].join(", "),
    reuseKey: `${role}-${subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`,
    license: "Drawgle curated internal library",
    status: isAllowedImage(file) && file.size <= MAX_UPLOAD_BYTES ? "ready" : "failed",
    error: !isAllowedImage(file)
      ? "Only PNG, JPEG, and WebP files are supported."
      : file.size > MAX_UPLOAD_BYTES
        ? "File is larger than 12MB."
        : null,
    result: null,
  };
};

export function CuratedAssetAdminPanel({ adminEmail }: { adminEmail: string | null }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draftsRef = useRef<AssetDraft[]>([]);
  const [drafts, setDrafts] = useState<AssetDraft[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    return () => {
      draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
    };
  }, []);

  const totals = useMemo(() => ({
    ready: drafts.filter((draft) => draft.status === "ready").length,
    uploaded: drafts.filter((draft) => draft.status === "uploaded").length,
    failed: drafts.filter((draft) => draft.status === "failed").length,
    uploading: drafts.filter((draft) => draft.status === "uploading").length,
  }), [drafts]);

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files).map(createDraft);
    setDrafts((current) => [...incoming, ...current]);
  };

  const updateDraft = (id: string, patch: Partial<AssetDraft>) => {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  };

  const removeDraft = (id: string) => {
    setDrafts((current) => {
      const target = current.find((draft) => draft.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((draft) => draft.id !== id);
    });
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      addFiles(event.target.files);
      event.target.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length) {
      addFiles(event.dataTransfer.files);
    }
  };

  const uploadDraft = async (draft: AssetDraft) => {
    if (draft.status !== "ready" && draft.status !== "failed") return;
    if (!draft.subject.trim() || !draft.role || !draft.assetType) {
      updateDraft(draft.id, { status: "failed", error: "Subject, role, and asset type are required." });
      return;
    }
    if (!isAllowedImage(draft.file) || draft.file.size > MAX_UPLOAD_BYTES) {
      updateDraft(draft.id, { status: "failed", error: "Upload a PNG, JPEG, or WebP file under 12MB." });
      return;
    }

    updateDraft(draft.id, { status: "uploading", error: null });

    const formData = new FormData();
    formData.set("file", draft.file);
    formData.set("subject", draft.subject.trim());
    formData.set("role", draft.role);
    formData.set("assetType", draft.assetType);
    formData.set("hasAlpha", String(draft.hasAlpha));
    formData.set("tags", draft.tags);
    formData.set("reuseKey", draft.reuseKey.trim());
    formData.set("license", draft.license.trim());

    try {
      const response = await fetch("/api/admin/curated-visual-assets/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Upload failed.");
      }

      updateDraft(draft.id, {
        status: "uploaded",
        result: payload as UploadedAssetResult,
        error: null,
      });
    } catch (error) {
      updateDraft(draft.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Upload failed.",
      });
    }
  };

  const uploadReadyDrafts = async () => {
    const readyDrafts = drafts.filter((draft) => draft.status === "ready");
    for (const draft of readyDrafts) {
      await uploadDraft(draft);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-slate-950">
      <header className="border-b border-slate-950/10 bg-white/90 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Drawgle Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Curated Asset Library</h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload approved PNGs and photos into the reusable R2 asset index.
            </p>
          </div>
          <div className="rounded-full border border-slate-950/10 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            {adminEmail || "Admin"}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div
            className={cn(
              "rounded-[24px] border border-dashed bg-white p-6 shadow-sm transition",
              isDragging ? "border-slate-950 bg-slate-50" : "border-slate-950/16",
            )}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              multiple
              onChange={handleFileInput}
              type="file"
            />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <UploadCloud className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">Drop curated assets</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              PNG, WebP, or JPEG. Upload one file per request under 12MB so imports stay reliable.
            </p>
            <Button
              className="mt-5 h-10 rounded-full px-4"
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              Choose images
            </Button>
          </div>

          <div className="rounded-[24px] border border-slate-950/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Import status</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Ready" value={totals.ready} />
              <Metric label="Uploading" value={totals.uploading} />
              <Metric label="Imported" value={totals.uploaded} />
              <Metric label="Failed" value={totals.failed} />
            </div>
            <Button
              className="mt-4 h-10 w-full rounded-full"
              disabled={!totals.ready || totals.uploading > 0}
              onClick={uploadReadyDrafts}
              type="button"
            >
              {totals.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import ready assets
            </Button>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-950/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-950/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Asset metadata</h2>
              <p className="text-xs text-slate-500">Metadata is used for resolver matching, so write subjects clearly.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {drafts.length} files
            </span>
          </div>

          {drafts.length ? (
            <div className="divide-y divide-slate-950/10">
              {drafts.map((draft) => (
                <AssetDraftRow
                  draft={draft}
                  key={draft.id}
                  onRemove={() => removeDraft(draft.id)}
                  onUpdate={(patch) => updateDraft(draft.id, patch)}
                  onUpload={() => uploadDraft(draft)}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                <ImageIcon className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">No assets queued</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Add your prepared PNGs or photos, review their metadata, then import them into the curated library.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function AssetDraftRow({
  draft,
  onRemove,
  onUpdate,
  onUpload,
}: {
  draft: AssetDraft;
  onRemove: () => void;
  onUpdate: (patch: Partial<AssetDraft>) => void;
  onUpload: () => void;
}) {
  const isBusy = draft.status === "uploading";
  const canEdit = draft.status !== "uploaded" && !isBusy;

  return (
    <div className="grid gap-4 p-5 xl:grid-cols-[112px_1fr_auto]">
      <div className="relative h-28 w-28 overflow-hidden rounded-3xl border border-slate-950/10 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={draft.subject} className="h-full w-full object-contain" src={draft.previewUrl} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Subject">
          <Input
            disabled={!canEdit}
            onChange={(event) => onUpdate({ subject: event.target.value })}
            value={draft.subject}
          />
        </Field>
        <Field label="Reuse key">
          <Input
            disabled={!canEdit}
            onChange={(event) => onUpdate({ reuseKey: event.target.value })}
            value={draft.reuseKey}
          />
        </Field>
        <Field label="Role">
          <Select
            disabled={!canEdit}
            onChange={(value) => onUpdate({ role: value as VisualAssetRole })}
            options={roleOptions}
            value={draft.role}
          />
        </Field>
        <Field label="Asset type">
          <Select
            disabled={!canEdit}
            onChange={(value) => onUpdate({ assetType: value as VisualAssetType })}
            options={assetTypeOptions}
            value={draft.assetType}
          />
        </Field>
        <Field label="Tags">
          <Input
            disabled={!canEdit}
            onChange={(event) => onUpdate({ tags: event.target.value })}
            value={draft.tags}
          />
        </Field>
        <Field label="License">
          <Input
            disabled={!canEdit}
            onChange={(event) => onUpdate({ license: event.target.value })}
            value={draft.license}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            checked={draft.hasAlpha}
            className="h-4 w-4 cursor-pointer rounded border-slate-300"
            disabled={!canEdit}
            onChange={(event) => onUpdate({ hasAlpha: event.target.checked })}
            type="checkbox"
          />
          Transparent background
        </label>
        <StatusLine draft={draft} />
      </div>

      <div className="flex items-start gap-2 xl:flex-col">
        <Button
          className="rounded-full"
          disabled={isBusy || draft.status === "uploaded"}
          onClick={onUpload}
          size="sm"
          type="button"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {draft.status === "uploaded" ? "Imported" : "Import"}
        </Button>
        <Button
          className="rounded-full"
          disabled={isBusy}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Select({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <select
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:bg-input/50 disabled:opacity-50"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StatusLine({ draft }: { draft: AssetDraft }) {
  if (draft.status === "uploaded" && draft.result) {
    return (
      <a
        className="flex min-w-0 items-center gap-2 text-sm font-medium text-emerald-700 hover:underline"
        href={draft.result.displayUrl}
        rel="noreferrer"
        target="_blank"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="truncate">Imported asset {draft.result.id}</span>
      </a>
    );
  }

  if (draft.error) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-red-600">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{draft.error}</span>
      </div>
    );
  }

  return (
    <div className="text-sm text-slate-500">
      {(draft.file.size / 1024 / 1024).toFixed(2)}MB - ready to import
    </div>
  );
}
