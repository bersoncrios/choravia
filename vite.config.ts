import { defineConfig } from "vite";
import { transformSync } from "@babel/core";
import angularLinker from "@angular/compiler-cli/linker/babel";
// Keep OAuth popups connected to their opener without cross-origin isolation.
const popupHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};
export default defineConfig(({ command }) => ({
  server: { headers: popupHeaders },
  preview: { headers: popupHeaders },
  plugins: [
    {
      name: "choravia-angular-linker",
      enforce: "pre",
      apply: "build",
      transform(code, id) {
        const file = id.split("?")[0] ?? id;
        if (
          !file.includes("/node_modules/@angular/") ||
          !code.includes("ɵɵngDeclare")
        )
          return null;
        const linked = transformSync(code, {
          filename: file,
          babelrc: false,
          configFile: false,
          compact: false,
          plugins: [angularLinker],
        });
        return linked?.code ? { code: linked.code, map: linked.map } : null;
      },
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (
            output.type === "chunk" &&
            /ɵɵngDeclare(?:Component|Directive|Injectable|Factory|NgModule|Pipe|Injector)\(/.test(
              output.code,
            )
          )
            this.error(
              "A build de produção contém declarações Angular parciais sem linker; não publique este bundle.",
            );
        }
      },
    },
    {
      name: "choravia-aot-entry",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return command === "build"
            ? html.replace("/src/dev.ts", "/.aot/main.js")
            : html;
        },
      },
    },
  ],
  define: command === "build" ? { ngDevMode: "false", ngJitMode: "false" } : {},
  build: { target: "es2022" },
}));
