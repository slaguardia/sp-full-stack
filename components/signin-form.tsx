"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, ShieldIcon, StarBadge, TankIcon } from "./insignia";

export function SigninForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl: string;
  initialError?: string;
}) {
  const [error, setError] = useState<string | null>(
    initialError ? "Credentials rejected. Try again, operator." : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!username || !password) {
      setError("Operator and passcode are required.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("Credentials rejected. Try again, operator.");
        setPending(false);
        return;
      }
      // Hard navigation ensures the new auth cookie is sent with the next
      // request and avoids an App Router race where router.refresh() refetches
      // /signin before router.replace() completes.
      window.location.assign(callbackUrl || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-10">
      <section
        className="relative border-[2.5px] border-steel bg-canvas-parchment"
        style={{ boxShadow: "6px 6px 0 var(--steel)" }}
      >
        <div className="hazard-stripe h-[8px]" aria-hidden />

        <div className="flex flex-col gap-5 px-6 py-6 sm:px-8 sm:py-7">
          <header className="flex items-center gap-3 border-b-2 border-steel pb-4">
            <span className="flex h-11 w-11 items-center justify-center border-2 border-steel bg-od text-hazard">
              <TankIcon size={28} />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-steel-soft">
                Checkpoint · Sector 04
              </span>
              <h1 className="font-stencil text-[30px] font-black uppercase leading-none text-steel">
                Guardhouse
              </h1>
            </div>
            <StarBadge size={22} className="ml-auto text-safety" />
          </header>

          <p className="font-sans text-[13.5px] leading-snug text-steel-soft">
            Authorized personnel only. Present operator ID and passcode to
            proceed to the classification floor.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <div className="field-label">
                <span className="field-num">01</span>
                <span>Operator ID</span>
              </div>
              <input
                name="username"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="field-input"
                placeholder="operator"
              />
            </div>
            <div>
              <div className="field-label">
                <span className="field-num">02</span>
                <span>Passcode</span>
                <span className="ml-auto text-safety">required</span>
              </div>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="field-input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="border-2 border-classified bg-[rgba(178,51,28,0.08)] p-3">
                <div className="mb-1 flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-classified">
                  <span className="h-2 w-2 rounded-full bg-classified siren-glow" />
                  Access denied
                </div>
                <p className="font-mono text-[12px] text-classified">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={pending} className="btn-ink">
                <ShieldIcon size={18} />
                {pending ? "Verifying…" : "Clear the gate"}
                <ArrowRight size={18} />
              </button>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-steel-soft">
                Est. wait · &lt;2s
              </span>
            </div>
          </form>
        </div>

        <div className="border-t-2 border-steel" />
        <div className="rivet-row" aria-hidden />
      </section>

      <p className="px-2 font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.18em] text-steel-soft">
        Credentials set via <code className="font-mono">AUTH_BASIC_CREDENTIALS</code>{" "}
        (base64 of <code className="font-mono">user:pass</code>). Contact the
        shift supervisor if you require rotation.
      </p>
    </div>
  );
}
