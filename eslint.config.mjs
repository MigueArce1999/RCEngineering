import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "scripts/**"] },
  {
    rules: {
      // R3F uses non-DOM JSX props (position, args, castShadow…)
      "react/no-unknown-property": "off",
    },
  },
];
export default config;
