import { CharStream, CommonTokenStream } from 'antlr4ng';
import { SimpleLangLexer } from './parser/src/SimpleLangLexer';
import { SimpleLangParser } from './parser/src/SimpleLangParser';
import { SimpleLangEvaluatorVisitor } from './EvaluatorVisitor';
import { VirtualMachine } from './VirtualMachine';
import { Compiler } from './Compiler';

export class SimpleLangEvaluator {
    private executionCount: number;
    public visitor: SimpleLangEvaluatorVisitor;
    public compiler: Compiler;
    public vm: VirtualMachine;

    constructor() {
        this.executionCount = 0;
        this.visitor = new SimpleLangEvaluatorVisitor();
    }

    async evaluateChunk(chunk: string): Promise<void> {
        this.executionCount++;
        try {
            // Create the lexer and parser
            const inputStream = CharStream.fromString(chunk);
            const lexer = new SimpleLangLexer(inputStream);
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new SimpleLangParser(tokenStream);

            // Parse the input
            const tree = parser.prog();

            // Convert the parsed tree into a json-like format
            const prog = this.visitor.visitProg(tree);
            console.log(JSON.stringify(prog));

            // Instantiate the compiler
            this.compiler = new Compiler();

            // Compile the program
            const instrs = this.compiler.compile_program(prog);
            console.log(instrs);

            // Instantiate the VM
            this.vm = new VirtualMachine();

            // Evaluate the instructions
            const result = this.vm.run(instrs);

            // Send the result to the REPL
            console.log(`Result of expression: ${result}`);
        } catch (error) {
            // Handle errors and send them to the REPL
            if (error instanceof Error) {
                console.log(`Error: ${error.message}`);
            } else {
                console.log(`Error: ${String(error)}`);
            }
        }
    }
}
