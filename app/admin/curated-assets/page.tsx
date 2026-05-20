import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CuratedAssetAdminPanel } from "@/components/admin/CuratedAssetAdminPanel";
import { AdminAuthError, requireAdminUser } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Curated Assets Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CuratedAssetsAdminPage() {
  try {
    const user = await requireAdminUser();
    return <CuratedAssetAdminPanel adminEmail={user.email ?? null} />;
  } catch (error) {
    if (error instanceof AdminAuthError && error.status === 401) {
      redirect("/login");
    }

    notFound();
  }
}
