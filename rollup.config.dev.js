import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
    treeshake: false,
    external: ['diagonjs'],
    plugins: [nodeResolve(), typescript()],
    input: "src/LocalEvaluator.ts",
    output: {
        dir: "dist",
        format: "esm",
        sourcemap: true,
    }
}
