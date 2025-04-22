import { initialise } from "conductor/dist/conductor/runner/util/";
import { BasicEvaluator } from "conductor/dist/conductor/runner";
import { IRunnerPlugin } from "conductor/dist/conductor/runner/types";
import { DustEvaluator } from "./Evaluator";

export class ConductorCompatibleDustEvaluator extends BasicEvaluator {
    private executionCount: number;
    private evaluator: DustEvaluator;

    constructor(conductor: IRunnerPlugin) {
        super(conductor);
        this.evaluator = new DustEvaluator();
        this.executionCount = 0;
    }

    async evaluateChunk(chunk: string): Promise<void> {
        this.executionCount++;
        try {
            // mapping of specific conductor-compatible builtins
            const custom_builtins = {
                'display' : this.conductor.sendOutput,
            }

            const [result, ownership_dag] = this.evaluator.evaluate(chunk, custom_builtins);

            // Send the result to the REPL
            this.conductor.sendOutput(`Result of expression: ${result.toString()}`);
        } catch (error) {
            // Handle errors and send them to the REPL
            if (error instanceof Error) {
                this.conductor.sendOutput(`Error: ${error.message}`);
            } else {
                this.conductor.sendOutput(`Error: ${String(error)}`);
            }
        }
    }
}

const { runnerPlugin, conduit } = initialise(ConductorCompatibleDustEvaluator);
