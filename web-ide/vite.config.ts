import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import vsixPlugin from "@codingame/monaco-vscode-rollup-vsix-plugin";
import importMetaUrlPlugin from "@codingame/esbuild-import-meta-url-plugin";

// https://vite.dev/config/
export default defineConfig({
    base: "./",
    plugins: [react(), vsixPlugin()],
    optimizeDeps: {
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
