"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronsUpDown,
  CreditCard,
  FolderSync,
  LogOut,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { PremiumDropdown } from "@/components/ui/premium-dropdown";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const getInitials = (name: string, email: string) => {
  const source = name || email || "U";
  return source.slice(0, 2).toUpperCase();
};

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const initials = getInitials(user.name, user.email);

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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <PremiumDropdown
          align="end"
          side={isMobile ? "bottom" : "right"}
          width={248}
          trigger={
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
            >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          }
          header={
            <div className="flex items-center gap-2 text-left">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-slate-900 dark:text-white">{user.name}</span>
                <span className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
              </div>
            </div>
          }
          items={[
            {
              id: "workspace",
              label: "Workspace",
              icon: FolderSync,
              onClick: () => {
                setOpenMobile(false);
                router.push("/project/new");
              },
            },
            {
              id: "account",
              label: "Account",
              icon: BadgeCheck,
              onClick: () => {
                setOpenMobile(false);
                router.push("/account");
              },
            },
            {
              id: "billing",
              label: "Billing",
              icon: CreditCard,
              onClick: () => {
                setOpenMobile(false);
                router.push("/billing");
              },
            },
            {
              id: "divider",
              label: "",
            },
            {
              id: "sign-out",
              label: isSigningOut ? "Signing out..." : "Log out",
              icon: LogOut,
              variant: "destructive",
              onClick: isSigningOut
                ? undefined
                : handleSignOut,
            },
          ]}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
