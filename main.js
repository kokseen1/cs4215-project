import { SimpleLangEvaluator } from './dist/Evaluator.js';

var evaluator = new SimpleLangEvaluator();

evaluator.evaluateChunk("let a = 1; let b = 2; let c = a + b; c;");
