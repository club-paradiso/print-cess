"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { hero } from "./promo-copy";
import styles from "./promo.module.css";

/**
 * - `waiting`: nothing decided yet (also the server render): the still shows.
 * - `still`: reduced motion, data saver or a 2G network; the film loads only
 *   when the visitor presses play.
 * - `playing` / `paused`: the film is loaded.
 * - `failed`: a file could not load; the still stays for good.
 */
type FilmState = "waiting" | "still" | "playing" | "paused" | "failed";

const SCENES = ["university", "airport"] as const;
type Scene = (typeof SCENES)[number];

/** How long the two films overlap. Long enough that the hand-over reads as one take. */
const CROSSFADE_SECONDS = 1.6;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function holdFilmBack(reducedMotion: boolean): boolean {
  if (reducedMotion) return true;
  const network = connection();
  if (network?.saveData) return true;
  return network?.effectiveType === "slow-2g" || network?.effectiveType === "2g";
}

/** The smallest file that fills this screen: the portrait cut on tall screens. */
function sourceFor(scene: Scene): string {
  const tall = window.matchMedia("(max-aspect-ratio: 4/5)").matches;
  return `/promo/${scene}-${tall ? "portrait" : "720"}.mp4`;
}

function Still({ scene, eager }: { scene: Scene; eager: boolean }) {
  return (
    <picture>
      <source media="(max-aspect-ratio: 4/5)" srcSet={`/promo/${scene}-poster-portrait.webp`} />
      {/* The still carries the scene's meaning; the film is decoration over it. */}
      <img
        className={styles.still}
        src={`/promo/${scene}-poster.webp`}
        alt=""
        width={1280}
        height={720}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
      />
    </picture>
  );
}

/**
 * The hero film: two muted clips that fade into one another and loop. It loads
 * after hydration, never on reduced motion, data saver or 2G unless the visitor
 * asks, plays only while on screen and while the tab is visible, and keeps the
 * still when anything fails.
 */
export function HeroFilm({ children }: { children: ReactNode }) {
  const section = useRef<HTMLDivElement | null>(null);
  const videos = useRef<Record<Scene, HTMLVideoElement | null>>({
    university: null,
    airport: null,
  });
  const [state, setState] = useState<FilmState>("waiting");
  const [active, setActive] = useState<Scene>("university");
  const [ready, setReady] = useState<Record<Scene, boolean>>({ university: false, airport: false });
  const [reducedMotion, setReducedMotion] = useState(false);
  const activeRef = useRef<Scene>("university");
  const userPaused = useRef(false);
  const onScreen = useRef(true);
  const stateRef = useRef<FilmState>("waiting");

  const change = useCallback((next: FilmState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const load = useCallback((scene: Scene) => {
    const element = videos.current[scene];
    if (!element || element.getAttribute("src")) return element;
    element.src = sourceFor(scene);
    element.load();
    return element;
  }, []);

  const show = useCallback((scene: Scene) => {
    activeRef.current = scene;
    setActive(scene);
  }, []);

  const start = useCallback(
    (scene: Scene) => {
      const element = load(scene);
      if (!element) return;
      element.currentTime = 0;
      void element.play().catch(() => {
        // Autoplay refused (Low Power Mode, a policy): keep the still, offer the button.
        change(element.error ? "failed" : "paused");
      });
    },
    [change, load],
  );

  const resume = useCallback(() => {
    const element = videos.current[activeRef.current];
    if (!element) return;
    load(activeRef.current);
    void element.play().catch(() => change(element.error ? "failed" : "paused"));
  }, [change, load]);

  const pauseAll = useCallback(() => {
    for (const scene of SCENES) videos.current[scene]?.pause();
  }, []);

  // Follow the visitor's reduced-motion setting, including a change mid-visit.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // While only film sits under the header, the header turns clear and white.
  // It turns solid again before the hero copy can slide underneath it.
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const root = document.documentElement;
    const copy = element.querySelector<HTMLElement>("[data-hero-copy]");
    let frame = 0;
    const update = () => {
      frame = 0;
      const header = 76;
      const stage = element.getBoundingClientRect();
      const copyTop = copy?.getBoundingClientRect().top ?? stage.top;
      root.dataset.promoOverFilm = stage.bottom > header && copyTop > header ? "true" : "";
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      delete root.dataset.promoOverFilm;
    };
  }, []);

  // Page-wide: the stylesheet drops its own animations too.
  useEffect(() => {
    document.documentElement.dataset.promoMotion = reducedMotion ? "reduced" : "";
    return () => {
      delete document.documentElement.dataset.promoMotion;
    };
  }, [reducedMotion]);

  // Decide once the preference is known. Short delay so the still paints first.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (stateRef.current === "failed") return;
      if (holdFilmBack(reducedMotion)) {
        pauseAll();
        change("still");
        return;
      }
      if (stateRef.current === "still") change("paused");
      if (!userPaused.current && onScreen.current) start(activeRef.current);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, change, pauseAll, start]);

  // Film events: which clip is playing, when to hand over to the other.
  useEffect(() => {
    const cleanups = SCENES.map((scene) => {
      const element = videos.current[scene];
      if (!element) return () => undefined;
      const other: Scene = scene === "university" ? "airport" : "university";
      const onFrame = () => setReady((current) => ({ ...current, [scene]: true }));
      const onPlaying = () => {
        if (activeRef.current === scene) change("playing");
      };
      const onTime = () => {
        if (activeRef.current !== scene || !Number.isFinite(element.duration)) return;
        if (element.duration - element.currentTime <= CROSSFADE_SECONDS) {
          show(other);
          start(other);
        }
      };
      const onEnded = () => {
        // The other clip took over during the fade; if not (a stalled tab), take over now.
        if (activeRef.current === scene) {
          show(other);
          start(other);
        }
        element.currentTime = 0;
      };
      const onPause = () => {
        if (activeRef.current === scene && stateRef.current !== "failed" && !element.ended) {
          change("paused");
        }
      };
      const onError = () => change("failed");
      element.addEventListener("loadeddata", onFrame);
      element.addEventListener("playing", onPlaying);
      element.addEventListener("timeupdate", onTime);
      element.addEventListener("ended", onEnded);
      element.addEventListener("pause", onPause);
      element.addEventListener("error", onError);
      return () => {
        element.removeEventListener("loadeddata", onFrame);
        element.removeEventListener("playing", onPlaying);
        element.removeEventListener("timeupdate", onTime);
        element.removeEventListener("ended", onEnded);
        element.removeEventListener("pause", onPause);
        element.removeEventListener("error", onError);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [change, show, start]);

  // Once the first clip plays, fetch the second so the fade has something to show.
  useEffect(() => {
    if (state === "playing") load(activeRef.current === "university" ? "airport" : "university");
  }, [state, load]);

  // Play only while on screen and while the tab is visible.
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const settle = () => {
      const allowed = onScreen.current && document.visibilityState === "visible";
      if (!allowed) {
        pauseAll();
        return;
      }
      if (
        !userPaused.current &&
        (stateRef.current === "paused" || stateRef.current === "playing")
      ) {
        resume();
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen.current = entry?.isIntersecting ?? true;
        settle();
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", settle);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", settle);
    };
  }, [pauseAll, resume]);

  const toggle = () => {
    if (state === "playing") {
      userPaused.current = true;
      pauseAll();
      change("paused");
      return;
    }
    userPaused.current = false;
    if (state === "still") change("paused");
    resume();
  };

  const showControl = state !== "failed" && state !== "waiting";
  const playing = state === "playing";

  return (
    <div ref={section} className={styles.heroStage} data-state={state}>
      <div className={styles.film} aria-hidden="true">
        {SCENES.map((scene) => (
          <div key={scene} className={styles.scene} data-active={active === scene}>
            <Still scene={scene} eager={scene === "university"} />
            <video
              ref={(element) => {
                videos.current[scene] = element;
              }}
              className={styles.video}
              data-ready={ready[scene] && state !== "failed" && state !== "still"}
              muted
              playsInline
              preload="none"
              tabIndex={-1}
              disablePictureInPicture
            />
          </div>
        ))}
        <span className={styles.shade} />
      </div>

      <div className={styles.heroBody}>
        <div className={styles.heroCopy} data-hero-copy>
          {children}
        </div>
      </div>

      <p className={styles.credit}>
        <span className="visually-hidden">{hero.filmLabel}. </span>
        {state === "still" && reducedMotion ? hero.stillNote : hero.filmNote}
      </p>

      {/* No visible film controls, by decision: the film is a quiet loop. This
          one stays for keyboard and screen-reader users (WCAG 2.2.2) and only
          appears while it has focus. */}
      {showControl ? (
        <button type="button" className={styles.focusPause} onClick={toggle}>
          {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
          {playing ? hero.pause : hero.play}
        </button>
      ) : null}
    </div>
  );
}
