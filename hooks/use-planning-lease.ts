"use client";
import { useEffect, useState } from "react";
import type { ProductPlanning } from "@/lib/product-planning/model";

export function usePlanningLease(lease?: ProductPlanning["lease"]) {
  const [expiredAt, setExpiredAt] = useState<string | null>(null);
  const expiresAt = lease?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timeout = window.setTimeout(() => setExpiredAt(expiresAt), Math.max(0, Date.parse(expiresAt) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [expiresAt]);
  return Boolean(expiresAt && expiredAt !== expiresAt);
}
