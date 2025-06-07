import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import vsixPlugin from "@codingame/monaco-vscode-rollup-vsix-plugin";
import importMetaUrlPlugin from "@codingame/esbuild-import-meta-url-plugin";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react({ tsDecorators: true }),
    vsixPlugin(),
    topLevelAwait({
      // The export name of top-level await promise for each chunk module
      promiseExportName: "__tla",
      // The function to generate import names of top-level await promise in each chunk module
      promiseImportName: (i) => `__tla_${i}`,
    }),
  ],
  esbuild: {
    drop: ['console', 'debugger'],
  },
  resolve: {
    alias: {
      buffer: "buffer",
      path: "path-browserify",
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ['js-big-decimal', '@wasmer/wasi'],
    esbuildOptions: {
      plugins: [
        {
          ...importMetaUrlPlugin,
          setup(build) {
            build.onResolve({ filter: /\.wasm$/ }, (args) => {
              return { path: args.path, external: true };
            });

            importMetaUrlPlugin.setup(build);
          },
        },
      ],
    },
  },
});
