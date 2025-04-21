import { LocalDustEvaluator } from '../dist/LocalEvaluator.js';

export const test = async (program, expected_type_or_error, visualize_ownership = false) => {
    const evaluator = new LocalDustEvaluator();
    await evaluator.testChunk(program, expected_type_or_error, visualize_ownership);
}

