"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CreditCard,
  LogOut,
  CircleDollarSign,
} from "lucide-react";

import { AnimatedThemeToggle } from "@/components/AnimatedThemeToggle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PremiumDropdown } from "@/components/ui/premium-dropdown";
import { useCreditManager } from "@/lib/credit-manager";

interface HeaderUserProps {
  user: {
    name: string;
    email: string;
    avatar: string;
    id: string;
  };
  initialCreditBalance: number;
}

export function HeaderUser({ user }: HeaderUserProps) {
  const router = useRouter();
  const { balance: creditBalance } = useCreditManager(user.id);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await fetch("/auth/signout", {
        method: "POST",
      });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out", error);
      setIsSigningOut(false);
    }
  };

  const menuItems = useMemo(
    () => [
      {
        id: "billing",
        label: "Billing",
        icon: CreditCard,
        onClick: () => router.push("/billing"),
      },
      {
        id: "account",
        label: "Account",
        icon: BadgeCheck,
        onClick: () => router.push("/account"),
      },
      {
        id: "divider",
        label: "",
      },
      {
        id: "sign-out",
        label: isSigningOut ? "Signing out..." : "Log out",
        icon: LogOut,
        onClick: isSigningOut ? undefined : handleSignOut,
        variant: "destructive" as const,
      },
    ],
    [isSigningOut, router],
  );

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
        <CircleDollarSign className="size-3.5" />
        <span className="text-sm font-medium text-foreground">
          {creditBalance.toLocaleString()}
        </span>
      </div>

      <AnimatedThemeToggle variant="circle" className="[&_svg]:size-4" />

      <PremiumDropdown
        align="end"
        side="bottom"
        width={224}
        trigger={
          <Button
            variant="ghost"
            className="relative h-8 w-8 rounded-full"
          >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          </Button>
        }
        header={
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-slate-900 dark:text-white">{user.name}</p>
            <p className="text-xs leading-none text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
        }
        items={menuItems}
      />
    </div>
  );
}
