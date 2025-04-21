import { to_diagon } from './Utils';
import { DustEvaluator } from './Evaluator';

export class LocalDustEvaluator {
    private evaluator: DustEvaluator;
    private diagon;

    constructor() {
        this.evaluator = new DustEvaluator();
    }

    async init_diagon() {
        const Diagon = await import("diagonjs");
        this.diagon = await Diagon.init();
    }

    async generate_visualization(ownership_dag) {
        if (!this.diagon) {
            await this.init_diagon();
        }

        return this.diagon.translate.graphDAG(
            to_diagon(ownership_dag)) || "no ownership moved";
    }

    async evaluateChunk(chunk: string) {
        const [result, ownership_dag] = this.evaluator.evaluate(chunk);
        console.log(`Result of expression: ${result}`);
        console.log("Ownership visualization:");
        console.log(await this.generate_visualization(ownership_dag));
    }

    async testChunk(chunk: string, visualize_ownership) {
        let result, ownership_dag;

        try {
            [result, ownership_dag] = this.evaluator.evaluate(chunk);
        } catch (e) {
            return [e + "", false]
        }

        if (visualize_ownership) {
            return [result, await this.generate_visualization(ownership_dag)];
        }
    }
}
