"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useLocale } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Upload,
  Building2,
  PieChart,
  BookOpen,
  Download,
  Menu,
  X,
  Globe,
  Settings,
} from "lucide-react";
import { useState } from "react";
import ProjectSwitcher from "@/components/layout/ProjectSwitcher";

const NAV_ITEMS = [
  { key: "home", href: "/", icon: Home },
  { key: "upload", href: "/upload", icon: Upload },
  { key: "analysis", href: "/analysis", icon: Building2 },
  { key: "portfolio", href: "/portfolio", icon: PieChart },
  { key: "courses", href: "/courses", icon: BookOpen },
  { key: "export", href: "/export", icon: Download },
] as const;

export default function Navbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const switchLocale = () => {
    const newLocale = locale === "en" ? "el" : "en";
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <PieChart className="h-7 w-7 text-primary" />
            <span className="hidden text-lg font-bold sm:inline">DEP-Gen</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.key)}
                </Link>
              );
            })}
          </div>

          {/* Right side: Project Switcher + Settings + Language + Mobile */}
          <div className="flex items-center gap-2">
            <ProjectSwitcher />

            <Link
              href="/settings"
              className={cn(
                "hidden rounded-lg p-2 transition-colors md:flex",
                pathname === "/settings"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={t("settings")}
            >
              <Settings className="h-4 w-4" />
            </Link>

            <button
              onClick={switchLocale}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Globe className="h-4 w-4" />
              {locale === "en" ? "EL" : "EN"}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 md:hidden hover:bg-muted"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="border-t border-border md:hidden">
          <div className="space-y-1 px-4 py-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.key)}
                </Link>
              );
            })}
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/settings"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              {t("settings")}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
