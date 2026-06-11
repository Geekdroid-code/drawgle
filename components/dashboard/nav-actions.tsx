"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, LayoutDashboard, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NavActions() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await fetch("/auth/signout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out", error);
      setSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Open user menu" className="rounded-full" />
          }
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt="User avatar" />
            <AvatarFallback className="text-xs">DG</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">Your Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <Link href="/project/new" prefetch={false}>
              Workspace
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <BadgeCheck className="mr-2 h-4 w-4" />
            <Link href="/account" prefetch={false}>
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            variant="destructive"
            className="cursor-pointer"
            disabled={signingOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default NavActions;
