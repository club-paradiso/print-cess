"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { hero } from "./promo-copy";
import styles from "./promo.module.css";
import { Screen } from "./screens";

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

/** How long the two films overlap while one fades into the other. */
const CROSSFADE_SECONDS = 1;

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
export function HeroFilm() {
  const section = useRef<HTMLDivElement | null>(null);
  const videos = useRef<Record<Scene, HTMLVideoElement | null>>({
    university: null,
    airport: null,
  });
  const [state, setState] = useState<FilmState>("waiting");
  const [active, setActive] = useState<Scene>("university");
  const [ready, setReady] = useState<Record<Scene, boolean>>({ university: false, airport: false });
  const [systemReduced, setSystemReduced] = useState(false);
  const [userReduced, setUserReduced] = useState(false);
  const [preview, setPreview] = useState(false);
  const reducedMotion = systemReduced || userReduced;
  const activeRef = useRef<Scene>("university");
  const userPaused = useRef(false);
  const onScreen = useRef(true);
  const stateRef = useRef<FilmState>("waiting");
  const pickers = useRef<Record<Scene, HTMLButtonElement | null>>({
    university: null,
    airport: null,
  });

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
    const update = () => setSystemReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
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
        pickers.current[scene]?.style.setProperty(
          "--progress",
          String(Math.min(1, element.currentTime / element.duration)),
        );
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
    if (preview) setPreview(false);
    if (state === "playing" && !preview) {
      userPaused.current = true;
      pauseAll();
      change("paused");
      return;
    }
    userPaused.current = false;
    if (state === "still") change("paused");
    resume();
  };

  const pickPreview = () => {
    setPreview(true);
    pauseAll();
  };

  const pick = (scene: Scene) => {
    setPreview(false);
    userPaused.current = false;
    for (const other of SCENES) {
      if (other !== scene) {
        videos.current[other]?.pause();
        pickers.current[other]?.style.setProperty("--progress", "0");
      }
    }
    show(scene);
    if (stateRef.current === "still") change("paused");
    start(scene);
  };

  const showControl = state !== "failed" && state !== "waiting";
  const playing = state === "playing" && !preview;

  return (
    <div ref={section} className={styles.film} data-state={state} data-preview={preview}>
      {SCENES.map((scene) => (
        <div key={scene} className={styles.scene} data-active={active === scene} aria-hidden="true">
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
      <div className={styles.picker} role="group" aria-label={hero.scenePicker}>
        {hero.scenes.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            ref={(element) => {
              pickers.current[id] = element;
            }}
            className={styles.pickerButton}
            aria-pressed={!preview && active === id}
            onClick={() => pick(id)}
          >
            <span className={styles.pickerFill} aria-hidden="true" />
            <span className={styles.pickerLabel}>{label}</span>
          </button>
        ))}
        <button
          type="button"
          className={styles.pickerButton}
          aria-pressed={preview}
          onClick={pickPreview}
        >
          <span className={styles.pickerLabel}>{hero.previewScene}</span>
        </button>
      </div>
      {preview ? (
        <div className={styles.heroDevice} aria-hidden="true">
          <Screen id="choose" />
        </div>
      ) : null}
      <div className={styles.filmBar}>
        <p className={styles.filmNote}>
          <span className="visually-hidden">{hero.filmLabel}. </span>
          {preview
            ? hero.previewNote
            : state === "still" && reducedMotion
              ? hero.stillNote
              : hero.filmNote}
        </p>
        <div className={styles.filmControls}>
          <button
            type="button"
            className={styles.filmButton}
            aria-pressed={userReduced}
            title={
              systemReduced && !userReduced ? "기기 설정에서 움직임을 줄이고 있어요" : undefined
            }
            onClick={() => setUserReduced((value) => !value)}
          >
            <span>{userReduced ? hero.motionDefault : hero.motionReduce}</span>
          </button>
          {showControl ? (
            <button
              type="button"
              className={styles.filmButton}
              onClick={toggle}
              aria-label={playing ? hero.pause : hero.play}
            >
              {playing ? (
                <Pause aria-hidden="true" size={18} />
              ) : (
                <Play aria-hidden="true" size={18} />
              )}
              <span>{playing ? hero.pause : hero.play}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
