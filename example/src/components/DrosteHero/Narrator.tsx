import clsx from "clsx";
import { forwardRef } from "react";

type NarratorProps = {
  say: string | null;
};

/** The drawn cursor, with an optional speech bubble. Positioned by the stage's frame loop, which also sets data-flip. */
export const Narrator = forwardRef<HTMLDivElement, NarratorProps>(
  function Narrator({ say }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className="group absolute left-0 top-0 z-20 pointer-events-none will-change-transform"
      >
        <svg
          viewBox="0 0 14 20"
          className="w-[26px] h-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
        >
          <path
            d="M1 1v15.5l4.2-4 3 6.6 2.6-1.2-3-6.4H14z"
            fill="#f3ebe6"
            stroke="#000"
            strokeWidth="1"
          />
        </svg>
        <span
          className={clsx(
            // Too wide for a phone stage; the HUD names the step there instead.
            "absolute left-[22px] top-[-6px] whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-caption text-black max-md:hidden",
            // Near the stage's right edge the stage flips the bubble to the cursor's left.
            "group-data-[flip=true]:left-auto group-data-[flip=true]:right-[6px] group-data-[flip=true]:top-[24px]",
            !say && "hidden",
          )}
        >
          {say}
        </span>
      </div>
    );
  },
);
