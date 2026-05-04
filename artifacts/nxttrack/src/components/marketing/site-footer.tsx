import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import { FOOTER_GROUPS, SITE } from "@/lib/marketing/site-data";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--surface-border)] bg-[var(--surface-soft)]">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2.6fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="relative size-10">
                <Image
                  src={SITE.logoSrc}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-contain"
                />
              </span>
              <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                NXTTRACK
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
              {SITE.description}
            </p>
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex items-center gap-2 text-[var(--text-primary)] hover:text-[#3f5a08] transition-colors"
              >
                <Mail className="size-4" />
                {SITE.email}
              </a>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.label}>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)]">
                  {group.label}
                </h4>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--surface-border)] pt-6 text-xs text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} NXTTRACK. Alle rechten voorbehouden.</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">
              Privacy
            </Link>
            <Link href="/voorwaarden" className="hover:text-[var(--text-primary)] transition-colors">
              Voorwaarden
            </Link>
            <span className="opacity-70">{SITE.tagline}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
