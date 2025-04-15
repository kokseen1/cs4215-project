import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import polyfillNode from "rollup-plugin-polyfill-node";
import copy from "rollup-plugin-copy";

export default {
    // external: ['diagonjs'],
    plugins: [nodeResolve(),
    commonjs(),
    polyfillNode(),     // <---- this enables fs/path in browser
    copy({
      targets: [
        {
          src: "node_modules/diagonjs/dist/diagon.js-1.1.wasm",
          dest: "dist"
        }
      ]
    }),
    typescript()],
    input: "src/ConductorCompatibleEvaluator.ts",
    output: {
        plugins: [terser()],
        dir: "dist",
        format: "iife",
        sourcemap: true,
        inlineDynamicImports: true, // <--- This makes it IIFE-compatible
    }
}
