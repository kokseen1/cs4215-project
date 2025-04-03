import { SimpleLangEvaluator } from './dist/Evaluator.js';

var evaluator = new SimpleLangEvaluator();

evaluator.evaluateChunk("fn f(a:&&i32) {}");
