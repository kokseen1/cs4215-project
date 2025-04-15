import nodeResolve from "@rollup/plugin-node-resolve";
// import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
    treeshake: false,
    external: ['diagonjs'],
    plugins: [nodeResolve(), typescript()],
    input: "src/Evaluator.ts",
    output: {
        dir: "dist",
        format: "esm",
        sourcemap: true,
    }
}
