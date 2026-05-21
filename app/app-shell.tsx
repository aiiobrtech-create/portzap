"use client";

import { usePathname } from "next/navigation";
import { SidebarNav } from "@/app/sidebar-nav";

type AppShellProps = {
  children: React.ReactNode;
  operatorName?: string;
  operatorEmail?: string;
};

const publicRouteMatchers = ["/login", "/definir-senha", "/primeiro-acesso"];

export function AppShell({
  children,
  operatorName,
  operatorEmail,
}: AppShellProps) {
  const pathname = usePathname();
  const isPublicRoute =
    publicRouteMatchers.includes(pathname) || pathname.startsWith("/q/");

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="appFrame">
      <SidebarNav
        operatorName={operatorName}
        operatorEmail={operatorEmail}
      />
      <div className="appViewport">{children}</div>
    </div>
  );
}
