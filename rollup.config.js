import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";

export default {
    // external: ['diagonjs'],
    plugins: [nodeResolve(),
        commonjs(),
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
