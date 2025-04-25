import { LocalDustEvaluator } from './dist/LocalEvaluator.js';
import { readFileSync } from 'fs';

var evaluator = new LocalDustEvaluator();

const prog = readFileSync('./main.rs', 'utf-8');
await evaluator.evaluateChunk(prog, true);