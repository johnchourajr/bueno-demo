type PlayButtonProps = {
  playing: boolean;
  onToggle: () => void;
  testId: string;
  /** What it plays, for screen readers: "the hero", "take 01". */
  label: string;
};

/** A square play/pause icon button. */
export function PlayButton({
  playing,
  onToggle,
  testId,
  label,
}: PlayButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={playing}
      aria-label={`${playing ? "Pause" : "Play"} ${label}`}
      onClick={onToggle}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border-0.5 border-dashed border-primary text-primary hover:bg-primary10 focus-visible:outline-1 focus-visible:outline-primary"
    >
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        fill="currentColor"
        className="h-3 w-3"
      >
        {playing ? (
          <path d="M2 1h3v10H2zM7 1h3v10H7z" />
        ) : (
          <path d="M2.5 1v10l8.5-5z" />
        )}
      </svg>
    </button>
  );
}
