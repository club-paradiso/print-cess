import type { ReactNode } from "react";

export type FileSource = {
  id: string;
  icon: ReactNode;
  label: string;
  /** What lives there, in a few words, where it helps someone choose. */
  hint?: string | undefined;
  onPick: () => void;
};

/**
 * Where a file comes from: the photo library or the file system, side by side
 * at equal weight. Which one a visitor needs depends on what they are holding
 * — a screenshot of a booking lives in Photos, an emailed PDF lives in Files —
 * and the service cannot know, so neither is styled as the expected answer.
 * One tap opens the system picker; nothing else is asked first.
 */
export function SourcePicker({ sources }: { sources: readonly FileSource[] }) {
  return (
    <div className="source-picker">
      {sources.map((source) => (
        <button key={source.id} type="button" className="source-tile" onClick={source.onPick}>
          <span className="source-tile__icon" aria-hidden="true">
            {source.icon}
          </span>
          <span className="source-tile__label">{source.label}</span>
          {source.hint ? <span className="source-tile__hint">{source.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}
