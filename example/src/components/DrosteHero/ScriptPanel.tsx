import clsx from "clsx";
import type { ScriptLine } from "./scenes";

type ScriptPanelProps = {
  file: string;
  script: ScriptLine[];
  active: number;
  /** Set in the storyboard, where lines pick the pin to highlight. */
  onPick?: (step: number) => void;
};

export function ScriptPanel({
  file,
  script,
  active,
  onPick,
}: ScriptPanelProps) {
  return (
    <div className="grid gap-2 min-w-0">
      <span className="text-string text-primary">{file}</span>
      <div className="overflow-x-auto font-mono text-[0.78rem] leading-[1.6] text-primary">
        {script.map((line, i) => {
          const on = line.step !== undefined && line.step === active;
          const className = clsx(
            "block w-full whitespace-pre rounded-sm pl-1 text-left transition-colors",
            on && "bg-primary text-black",
          );
          if (onPick && line.step !== undefined) {
            const step = line.step;
            return (
              <button
                key={i}
                type="button"
                data-testid={`script-line-${i}`}
                className={clsx(
                  className,
                  "hover:bg-primary10 focus-visible:outline-1 focus-visible:outline-primary",
                )}
                onMouseEnter={() => onPick(step)}
                onFocus={() => onPick(step)}
              >
                <span>{step + 1} </span>
                {line.text.trimStart()}
              </button>
            );
          }
          return (
            <span key={i} className={className}>
              {line.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
