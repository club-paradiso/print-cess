"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { nav } from "./promo-copy";
import styles from "./promo.module.css";

/** Native disclosure remains usable without JS; enhance dismiss and focus behavior. */
export function PromoMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const element = menu.current;
      if (element?.open && event.target instanceof Node && !element.contains(event.target)) {
        element.open = false;
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    <details
      ref={menu}
      className={styles.menu}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          event.preventDefault();
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
    >
      <summary className={styles.menuButton}>
        <Menu aria-hidden="true" size={20} className={styles.menuOpen} />
        <X aria-hidden="true" size={20} className={styles.menuClose} />
        <span>{nav.menu}</span>
      </summary>
      <nav aria-label={`${nav.label} (메뉴)`} className={styles.menuList}>
        {nav.items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={() => {
              if (menu.current) menu.current.open = false;
              const target = document.querySelector(item.href);
              const heading = target?.querySelector<HTMLElement>("h2");
              if (heading) {
                heading.tabIndex = -1;
                requestAnimationFrame(() => heading.focus({ preventScroll: true }));
              }
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
