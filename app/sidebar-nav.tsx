"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  Archive,
  BarChart3,
  QrCode,
  Menu,
  House,
  LogOut,
  X,
  PackagePlus,
  Settings2,
  UserCircle2,
  Users,
} from "lucide-react";
import { logoutOperator } from "@/app/security-actions";
import iconColor from "../logo/icon-color.png";

const navItems = [
  {
    href: "/",
    label: "Painel",
    icon: House,
  },
  {
    href: "/historico",
    label: "Historico",
    icon: Archive,
  },
  {
    href: "/relatorios",
    label: "Relatorios",
    icon: BarChart3,
  },
  {
    href: "/nova-encomenda",
    label: "Nova encomenda",
    icon: PackagePlus,
  },
  {
    href: "/moradores",
    label: "Moradores",
    icon: Users,
  },
  {
    href: "/configuracoes",
    label: "Configuracoes",
    icon: Settings2,
  },
  {
    href: "/retirada",
    label: "Retirada QR",
    icon: QrCode,
  },
] as const;

type SidebarNavProps = {
  operatorName?: string;
  operatorEmail?: string;
};

export function SidebarNav({
  operatorName,
  operatorEmail,
}: SidebarNavProps) {
  const pathname = usePathname();
  const toggleId = "app-sidebar-toggle";
  const toggleRef = useRef<HTMLInputElement | null>(null);

  const closeSidebar = () => {
    if (toggleRef.current) {
      toggleRef.current.checked = false;
    }
  };

  useEffect(() => {
    closeSidebar();
  }, [pathname]);

  return (
    <>
      <input
        ref={toggleRef}
        id={toggleId}
        className="sidebarToggleInput"
        type="checkbox"
        aria-hidden="true"
      />

      <div className="mobileTopbar">
        <div className="mobileTopbarBrand">
          <span className="sidebarBrandIconWrap mobileBrandIconWrap">
            <Image
              src={iconColor}
              alt="Portzap"
              className="sidebarBrandIcon"
              priority
            />
          </span>
          <div className="mobileTopbarText">
            <strong>Portzap</strong>
            <span>Gestão de encomendas</span>
          </div>
        </div>

        <label
          htmlFor={toggleId}
          className="mobileMenuButton"
          aria-controls="app-sidebar"
          aria-label="Abrir ou fechar menu"
          role="button"
          tabIndex={0}
        >
          <Menu className="mobileMenuIconOpen" size={20} />
          <X className="mobileMenuIconClose" size={20} />
        </label>
      </div>

      <label
        htmlFor={toggleId}
        className="sidebarOverlay"
        aria-label="Fechar menu"
      />

      <aside id="app-sidebar" className="sidebarShell">
        <div className="sidebarBrand">
          <span className="sidebarEyebrow">Portaria operacional</span>
          <div className="sidebarBrandRow">
            <span className="sidebarBrandIconWrap">
              <Image
                src={iconColor}
                alt="Portzap"
                className="sidebarBrandIcon"
                priority
              />
            </span>
            <div className="sidebarBrandText">
              <strong>Portzap</strong>
              <span>Gestão de encomendas</span>
            </div>
          </div>
        </div>

        <nav className="sidebarNav">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={`sidebarLink${isActive ? " is-active" : ""}`}
                onClick={closeSidebar}
              >
                <span className="sidebarLinkIcon">
                  <Icon size={18} />
                </span>
                <span className="sidebarLinkLabel">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebarFooter">
          <div className="sidebarAccountCard">
            <div className="sidebarAccountTop">
              <span className="sidebarAccountAvatar">
                <UserCircle2 size={18} />
              </span>
              <div className="sidebarAccountText">
                <strong>{operatorName ?? "Conta do condomínio"}</strong>
                <span>{operatorEmail ? operatorEmail : "Conta vinculada ao condomínio"}</span>
              </div>
            </div>

            <div className="sidebarAccountActions">
              <Link href="/conta" className="sidebarAccountAction" onClick={closeSidebar}>
                <UserCircle2 size={16} />
                <span>Conta</span>
              </Link>
              <form action={logoutOperator}>
                <button type="submit" className="sidebarAccountAction sidebarAccountActionSubmit">
                  <LogOut size={16} />
                  <span>Sair</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
