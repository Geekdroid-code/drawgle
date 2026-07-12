"use client";

import { type ReactElement, useEffect, useState } from "react";
import { Check, Copy, Globe2, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type PreviewShareState = {
  enabled: boolean;
  path: string | null;
  url: string | null;
};

type PreviewShareDialogProps = {
  projectId: string;
  projectName: string;
  initialEnabled?: boolean;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const emptyShareState = (enabled = false): PreviewShareState => ({
  enabled,
  path: null,
  url: null,
});

export function PreviewShareDialog({
  projectId,
  projectName,
  initialEnabled = false,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: PreviewShareDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [shareState, setShareState] = useState<PreviewShareState>(() => emptyShareState(initialEnabled));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<"enable" | "disable" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadShareState = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${projectId}/preview-share`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load the share link.");
        }
        if (!cancelled) {
          setShareState(payload as PreviewShareState);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the share link.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadShareState();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const updateSharing = async (enabled: boolean) => {
    setSaving(enabled ? "enable" : "disable");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/preview-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update sharing.");
      }
      setShareState(payload as PreviewShareState);
      if (!enabled) {
        setCopied(false);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update sharing.");
    } finally {
      setSaving(null);
    }
  };

  const copyLink = async () => {
    if (!shareState.url) return;
    try {
      await navigator.clipboard.writeText(shareState.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the preview link.");
    }
  };

  const isBusy = loading || saving !== null;
  const enabledUrl = shareState.enabled ? shareState.url : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="w-[min(440px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[24px] border border-slate-950/[0.08] bg-white p-0 shadow-[0_24px_90px_rgba(15,23,42,0.22)] dark:border-white/[0.08] dark:bg-[#1b1b1b]">
        <DialogHeader className="gap-2 px-5 pb-3 pt-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            {shareState.enabled ? <Globe2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </div>
          <DialogTitle className="text-lg font-semibold tracking-[-0.01em] text-slate-950 dark:text-slate-50">
            Share Preview
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            Create a public read-only canvas link for {projectName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 px-5 pb-5 pt-2">
          {enabledUrl ? (
            <div className="flex min-w-0 items-center gap-2">
              <Input
                value={enabledUrl}
                readOnly
                className="h-10 min-w-0 rounded-full border-slate-950/[0.08] bg-slate-50 text-xs font-medium text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-slate-200"
              />
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full dg-button-primary hover:dg-button-primary"
                disabled={isBusy}
                onClick={copyLink}
                aria-label="Copy preview link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-slate-950/[0.12] bg-slate-50 px-4 py-4 text-sm font-medium leading-6 text-slate-600 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-slate-400">
              Public preview sharing is currently disabled.
            </div>
          )}

          {error ? (
            <div className="rounded-[12px] bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 flex-row justify-end gap-2 rounded-none border-t border-slate-950/[0.08] bg-slate-50/80 px-5 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
          {shareState.enabled ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-4"
              disabled={isBusy}
              onClick={() => updateSharing(false)}
            >
              {saving === "disable" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disable
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-10 rounded-full dg-button-primary hover:dg-button-primary px-5 text-white"
            disabled={isBusy}
            onClick={() => shareState.enabled ? copyLink() : updateSharing(true)}
          >
            {saving === "enable" || loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {shareState.enabled ? (copied ? "Copied" : "Copy Link") : "Enable Sharing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
