import { SimpleLangEvaluator } from './dist/Evaluator.js';
import { readFileSync } from 'fs';

var evaluator = new SimpleLangEvaluator();

const prog = readFileSync('./main.rs', 'utf-8');
evaluator.evaluateChunk(prog);
