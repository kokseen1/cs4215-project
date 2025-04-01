import { SimpleLangEvaluator } from './dist/Evaluator.js';

var evaluator = new SimpleLangEvaluator();

evaluator.evaluateChunk("if true {-1;} else {2;};");
console.log(evaluator.visitor.instrs);
