"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PRIMARY_NAV, SITE } from "@/lib/marketing/site-data";
import { cn } from "@/lib/utils";

function isGroup(item: (typeof PRIMARY_NAV)[number]): item is Extract<
  (typeof PRIMARY_NAV)[number],
  { items: unknown }
> {
  return "items" in item;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);

  // Sluit submenu's bij navigatie-wijziging.
  useEffect(() => {
    setOpenGroup(null);
    setOpen(false);
  }, [pathname]);

  // Sluit submenu bij klik buiten het navigatie-element.
  useEffect(() => {
    if (!openGroup) return;
    function handlePointerDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openGroup]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--surface-border)] bg-white/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-4">
          <Link href="/" className="flex items-center group" aria-label="NXTTRACK home">
            <span className="relative h-10 w-32 sm:h-12 sm:w-40">
              <Image
                src={SITE.logoSrc}
                alt="NXTTRACK"
                fill
                sizes="(min-width: 640px) 160px, 128px"
                className="object-contain object-left"
                priority
              />
            </span>
          </Link>

          {/* Desktop nav */}
          <nav
            ref={navRef}
            className="hidden lg:flex items-center gap-1"
            aria-label="Hoofdnavigatie"
          >
            {PRIMARY_NAV.map((item) => {
              if (isGroup(item)) {
                const isOpen = openGroup === item.label;
                return (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => setOpenGroup(item.label)}
                    onMouseLeave={() => setOpenGroup(null)}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroup((cur) => (cur === item.label ? null : item.label))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setOpenGroup(null);
                        if (
                          (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") &&
                          !isOpen
                        ) {
                          e.preventDefault();
                          setOpenGroup(item.label);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                        isOpen ? "bg-[var(--surface-soft)] text-[var(--text-primary)]" : "",
                      )}
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                    >
                      {item.label}
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform",
                          isOpen ? "rotate-180" : "",
                        )}
                      />
                    </button>
                    {isOpen ? (
                      <div className="absolute left-0 top-full pt-3">
                        <div
                          className="w-[560px] rounded-3xl border border-[var(--surface-border)] bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)] p-3"
                          role="menu"
                        >
                          <div className="grid grid-cols-2 gap-1">
                            {item.items.map((sub) => {
                              const Icon = sub.icon;
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  role="menuitem"
                                  onClick={() => setOpenGroup(null)}
                                  className="flex gap-3 rounded-2xl p-3 hover:bg-[var(--surface-soft)] focus-visible:bg-[var(--surface-soft)] focus-visible:outline-none transition-colors"
                                >
                                  {Icon ? (
                                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[#3f5a08]">
                                      <Icon className="size-5" strokeWidth={1.75} />
                                    </span>
                                  ) : null}
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-[var(--text-primary)]">
                                      {sub.label}
                                    </span>
                                    {sub.description ? (
                                      <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-secondary)]">
                                        {sub.description}
                                      </span>
                                    ) : null}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--surface-soft)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-soft)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="hidden md:inline-flex rounded-full text-sm font-medium"
            >
              <Link href="/login">Inloggen</Link>
            </Button>
            <Button
              asChild
              className="hidden sm:inline-flex rounded-full bg-[#1c2616] text-white hover:bg-[#0b0f0a] shadow-md h-10 px-5 text-sm font-semibold"
            >
              <Link href="/contact">
                Plan kennismaking
                <ArrowRight className="size-4" />
              </Link>
            </Button>

            {/* Mobile menu */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="lg:hidden inline-flex size-10 items-center justify-center rounded-full hover:bg-[var(--surface-soft)] transition-colors"
                  aria-label="Open menu"
                >
                  {open ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-white">
                <SheetHeader className="border-b border-[var(--surface-border)] px-6 py-4">
                  <SheetTitle className="flex items-center text-base font-semibold">
                    <span className="relative h-10 w-32">
                      <Image
                        src={SITE.logoSrc}
                        alt="NXTTRACK"
                        fill
                        sizes="128px"
                        className="object-contain object-left"
                      />
                    </span>
                  </SheetTitle>
                </SheetHeader>

                <div className="overflow-y-auto px-3 py-2 max-h-[calc(100vh-4rem)]">
                  <Accordion type="multiple" className="w-full">
                    {PRIMARY_NAV.map((item) => {
                      if (isGroup(item)) {
                        return (
                          <AccordionItem
                            key={item.label}
                            value={item.label}
                            className="border-b-[var(--surface-border)]"
                          >
                            <AccordionTrigger className="px-3 py-3 text-base font-medium text-[var(--text-primary)] hover:no-underline">
                              {item.label}
                            </AccordionTrigger>
                            <AccordionContent className="pb-2 pt-0">
                              <div className="flex flex-col gap-1 pl-3">
                                {item.items.map((sub) => {
                                  const Icon = sub.icon;
                                  return (
                                    <Link
                                      key={sub.href}
                                      href={sub.href}
                                      onClick={() => setOpen(false)}
                                      className="flex items-start gap-3 rounded-2xl px-3 py-2.5 hover:bg-[var(--surface-soft)] transition-colors"
                                    >
                                      {Icon ? (
                                        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[#3f5a08]">
                                          <Icon className="size-4" strokeWidth={1.75} />
                                        </span>
                                      ) : null}
                                      <span className="min-w-0">
                                        <span className="block text-sm font-medium text-[var(--text-primary)]">
                                          {sub.label}
                                        </span>
                                        {sub.description ? (
                                          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-secondary)]">
                                            {sub.description}
                                          </span>
                                        ) : null}
                                      </span>
                                    </Link>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      }
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between border-b border-[var(--surface-border)] px-3 py-4 text-base font-medium text-[var(--text-primary)]"
                        >
                          {item.label}
                          <ArrowRight className="size-4 text-[var(--text-secondary)]" />
                        </Link>
                      );
                    })}
                  </Accordion>

                  <div className="mt-6 flex flex-col gap-2 px-2 pb-6">
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-2xl h-12 text-sm font-medium"
                    >
                      <Link href="/login" onClick={() => setOpen(false)}>
                        Inloggen
                      </Link>
                    </Button>
                    <Button
                      asChild
                      className="rounded-2xl h-12 bg-[#1c2616] text-white hover:bg-[#0b0f0a] text-sm font-semibold"
                    >
                      <Link href="/contact" onClick={() => setOpen(false)}>
                        Plan kennismakingsgesprek
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
