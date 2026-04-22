"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { TankIcon } from "./insignia";

const ITEMS = [
  { href: "/", label: "Intake", code: "01" },
  { href: "/history", label: "Register", code: "02" },
  { href: "/codes", label: "Catalog", code: "03" },
  { href: "/method", label: "Doctrine", code: "04" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const onSigninPage = pathname?.startsWith("/signin");

  return (
    <header className="relative border-b-[2.5px] border-steel bg-steel text-canvas-parchment">
      {/* Top hazard stripe — the caution tape at every loading dock. */}
      <div className="hazard-stripe h-[6px]" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group flex items-center gap-3 no-underline"
        >
          <span
            className="relative flex h-10 w-10 shrink-0 items-center justify-center border-2 border-canvas-parchment bg-od text-hazard"
            aria-hidden
          >
            <TankIcon size={26} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.34em] text-hazard">
              FSC // Supply Corps
            </span>
            <span className="font-stencil text-[22px] font-black uppercase tracking-[0.04em] text-canvas-parchment">
              Classification Depot
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`group relative inline-flex items-center gap-2 border-2 px-3 py-2 font-sans text-[12px] font-bold uppercase leading-none tracking-[0.18em] transition-colors [&>span]:pointer-events-none ${
                  active
                    ? "border-hazard bg-hazard text-steel"
                    : "border-transparent text-canvas-parchment hover:border-canvas-parchment/40 hover:text-hazard"
                }`}
              >
                <span
                  aria-hidden
                  className={`font-mono text-[10px] font-medium tracking-normal ${
                    active ? "text-steel-soft" : "text-rivet-soft group-hover:text-hazard"
                  }`}
                >
                  {item.code}
                </span>
                <span>{item.label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-[6px] left-1/2 h-[6px] w-[6px] -translate-x-1/2 rotate-45 bg-hazard"
                  />
                )}
              </Link>
            );
          })}
          {!onSigninPage && (
            <div className="ml-3 hidden items-center gap-2 border-l border-rivet/60 pl-3 sm:flex">
              {status === "authenticated" && session?.user?.name ? (
                <>
                  <span className="flex flex-col items-end leading-none">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-rivet-soft">
                      Operator
                    </span>
                    <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-hazard">
                      {session.user.name}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/signin" })}
                    className="border-2 border-canvas-parchment/40 px-2.5 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-canvas-parchment transition-colors hover:border-safety hover:bg-safety hover:text-canvas-parchment"
                  >
                    Sign out
                  </button>
                </>
              ) : status === "loading" ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-rivet-soft">
                  …
                </span>
              ) : null}
            </div>
          )}
        </nav>
      </div>

      {/* Bottom rivet row */}
      <div className="rivet-row-dark" aria-hidden />
    </header>
  );
}
