import { display, to_diagon } from './Utils';
import { DustEvaluator } from './Evaluator';

export class LocalDustEvaluator {
    private evaluator: DustEvaluator;
    private diagon;

    private custom_builtins = {
        'display': console.log 
    }

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

    async evaluateChunk(chunk: string, visualize_ownership: boolean = false) {
        const [result, ownership_dag] = this.evaluator.evaluate(chunk, this.custom_builtins);
        console.log(`Result of expression: ${result}`);
        if (visualize_ownership) {
            console.log("Ownership visualization:");
            console.log(await this.generate_visualization(ownership_dag));
        }
    }

    async testChunk(chunk: string, expected_type_or_error, visualize_ownership) {
        let result, ownership_dag;
        try {
            [result, ownership_dag] = this.evaluator.evaluate(chunk, this.custom_builtins);
        }
        catch (e) {
            result = e + "";
        }

        if (result === expected_type_or_error) {
            if (visualize_ownership && ownership_dag) {
                const diagon_dag = await this.generate_visualization(ownership_dag)
                console.log(chunk)
                console.log("Ownership visualization:")
                console.log(diagon_dag)
            }
            console.log("pass")
        } else {
            console.log("fail!")
            console.log(chunk)
            console.log("expected result: " + expected_type_or_error)
            console.log("computed result: " + result)
        }
        console.log("-----------------------------------------------")
    }
}
