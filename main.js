import { SimpleLangEvaluator } from './dist/Evaluator.js';

var evaluator = new SimpleLangEvaluator();

evaluator.evaluateChunk("if (false) {1;} else if (0) {2;} else if (true) {3;};");
