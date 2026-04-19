// GENERATED — do not edit. Source: mantle-business/brand/

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const BRAND_DIR = dirname(fileURLToPath(import.meta.url));

const ICONS = [
  { name: "favicon.svg", type: "image/svg+xml" },
  { name: "apple-touch-icon-180x180.png", type: "image/png" },
  { name: "pwa-192x192.png", type: "image/png" },
  { name: "pwa-512x512.png", type: "image/png" },
] as const;

export function mantleBrandIcons(): Plugin {
  return {
    name: "mantle-brand-icons",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        const icon = ICONS.find((i) => url === `/${i.name}`);
        if (!icon) return next();
        res.setHeader("Content-Type", icon.type);
        res.end(readFileSync(join(BRAND_DIR, icon.name)));
      });
    },
    generateBundle() {
      for (const icon of ICONS) {
        this.emitFile({
          type: "asset",
          fileName: icon.name,
          source: readFileSync(join(BRAND_DIR, icon.name)),
        });
      }
    },
  };
}

// Inlines the pre-rendered phase-1 loader bundle into index.html at the
// <!-- mantle-loader --> anchor, so the overlay paints before any JS bundle
// loads. Consumers drive teardown via window.mantleLoader.finish().
export function mantleLoaderBundle(
  opts: { theme?: "auto" | "dark" | "light" } = {},
): Plugin {
  const theme = opts.theme ?? "auto";
  const file =
    theme === "auto"
      ? "loader/bundle.html"
      : `loader/bundle-${theme}.html`;

  return {
    name: "mantle-loader-bundle",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const bundle = readFileSync(join(BRAND_DIR, file), "utf8");
        const anchor = "<!-- mantle-loader -->";
        if (html.includes(anchor)) return html.replace(anchor, bundle);
        return html.replace("<body>", `<body>\n${bundle}`);
      },
    },
  };
}
