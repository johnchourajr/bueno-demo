import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...coreWebVitals,
  { ignores: [".next/**", "out/**", "next-env.d.ts"] },
];

export default config;
