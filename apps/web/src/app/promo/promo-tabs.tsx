"use client";

import { useEffect, useState } from "react";

import { nav } from "./promo-copy";
import styles from "./promo.module.css";

type View = (typeof nav.items)[number]["view"];

function targetOf(hash: string): HTMLElement | null {
  try {
    const id = decodeURIComponent(hash.slice(1));
    return id ? document.getElementById(id) : null;
  } catch {
    return null;
  }
}

function viewOf(target: HTMLElement | null): View {
  const panel = target?.closest<HTMLElement>("[data-view]")?.dataset.view;
  return nav.items.find((item) => item.view === panel)?.view ?? "home";
}

/**
 * The top tabs, and the in-page link handling that makes them views.
 *
 * Before hydration and without JavaScript, CSS `:target` picks the view
 * (promo.module.css). Once hydrated, this owns in-page links: the App Router
 * rewrites the URL after a native fragment jump, so links push their fragment
 * with the router's own history state and the chosen view is written to
 * `data-active-view` on <main>. On phones the tabs take their own row.
 */
export function PromoTabs() {
  const [active, setActive] = useState<View>("home");

  useEffect(() => {
    const main = document.getElementById("main");
    let frame = 0;
    const show = (hash: string, focus: boolean) => {
      const target = targetOf(hash);
      const view = viewOf(target);
      setActive(view);
      if (main) main.dataset.activeView = view;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!target) return;
        // A view's opener starts the view from the top, under the sticky header.
        const opensView = target.matches("[data-view] > :first-child");
        if (opensView) window.scrollTo({ top: 0 });
        else target.scrollIntoView({ block: "start" });
        if (!focus) return;
        const heading = opensView
          ? (target.querySelector<HTMLElement>("h1, h2") ?? target)
          : target;
        if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      });
    };
    const clicked = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
          : null;
      if (!link || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!targetOf(link.hash)) return;
      event.preventDefault();
      if (link.hash !== window.location.hash) {
        window.history.pushState(window.history.state, "", link.hash);
      }
      show(link.hash, true);
    };
    const popped = () => show(window.location.hash, false);
    show(window.location.hash, false);
    document.addEventListener("click", clicked);
    window.addEventListener("popstate", popped);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", clicked);
      window.removeEventListener("popstate", popped);
    };
  }, []);

  return (
    <nav aria-label={nav.label} className={styles.nav}>
      {nav.items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.view === active ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
