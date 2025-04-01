import { SimpleLangEvaluator } from './dist/Evaluator.js';

var evaluator = new SimpleLangEvaluator();

evaluator.evaluateChunk("1;");
console.log(evaluator.visitor.instrs);
