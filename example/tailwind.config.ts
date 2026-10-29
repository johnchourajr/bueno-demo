import { buenTypeTailwind } from "@bueno-dev/type";
import type { Config } from "tailwindcss";
import { PluginAPI } from "tailwindcss/types/config";
import { customHeadlines, customTexts } from "./src/config/type";

function typePlugin({ addUtilities }: PluginAPI) {
  buenTypeTailwind(
    { addUtilities },
    {
      customTexts,
      customHeadlines,
      disableDefaults: false,
      customMinScreenSize: 480,
    },
  );
}

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    borderWidth: {
      DEFAULT: "1px",
      "0.5": "0.5px",
      "1": "1px",
      "2": "2px",
      "3": "3px",
    },
    colors: {
      transparent: "transparent",
      primary: "rgb(var(--color-primary))",
      primary60: "rgb(var(--color-primary) / 0.6)",
      primary25: "rgb(var(--color-primary) / 0.25)",
      primary10: "rgb(var(--color-primary) / 0.1)",
      secondary: "rgb(var(--color-secondary))",
      paper: "rgb(var(--color-paper))",
      paper60: "rgb(var(--color-paper) / 0.6)",
      black: "rgb(var(--color-secondary))",
      black90: "rgb(var(--color-secondary) / 0.9)",
      black60: "rgb(var(--color-secondary) / 0.6)",
      black40: "rgb(var(--color-secondary) / 0.4)",
    },
    extend: {
      keyframes: {
        ripple: {
          from: { scale: "0.2", opacity: "0.9" },
          to: { scale: "1.4", opacity: "0" },
        },
      },
      animation: {
        ripple: "ripple 0.6s ease-out",
      },
      fontFamily: {
        bold: ["GoshaSans-Ultrabold", "sans-serif"],
        sans: ["GoshaSans-Regular", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      textUnderlineOffset: {
        DEFAULT: "1px",
        "1": "1px",
        "2": "2px",
        "3": "3px",
        "4": "4px",
      },
    },
  },
  plugins: [typePlugin],
};

export default config;
