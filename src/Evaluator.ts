import { CharStream, CommonTokenStream } from 'antlr4ng';
import { SimpleLangLexer } from './parser/src/SimpleLangLexer';
import { SimpleLangParser } from './parser/src/SimpleLangParser';
import { SimpleLangEvaluatorVisitor } from './EvaluatorVisitor';
import { VirtualMachine } from './VirtualMachine';
import { Compiler } from './Compiler';
import { TypeChecker } from './TypeChecker';

export class SimpleLangEvaluator {
    public visitor: SimpleLangEvaluatorVisitor;
    public typeChecker: TypeChecker;
    public compiler: Compiler;
    public vm: VirtualMachine;

    constructor() {
        this.visitor = new SimpleLangEvaluatorVisitor();
    }

    public parse_compile_run = (chunk) => {
        const inputStream = CharStream.fromString(chunk);
        const lexer = new SimpleLangLexer(inputStream);
        const tokenStream = new CommonTokenStream(lexer);
        const parser = new SimpleLangParser(tokenStream);

        // Parse the input
        const tree = parser.prog();

        // Convert the parsed tree into a json-like format
        const prog = this.visitor.visit(tree);
        console.log(JSON.stringify(prog));

        // Instantiate the TypeChecker
        this.typeChecker = new TypeChecker();

        // Instantiate the VM
        this.vm = new VirtualMachine();

        // Instantiate the compiler
        this.compiler =
            new Compiler(this.vm.get_builtins(), this.vm.get_constants());

        // Type check the program
        const [is_success, checked_prog] =
            this.typeChecker.type_program(prog);

        // Compile the program
        const instrs = this.compiler.compile_program(prog);

        // Print the instructions
        // instrs.map((e, i) => {
        //     process.stdout.write(i + ": ")
        //     console.dir(e, { depth: null });
        // })

        // Evaluate the instructions
        const result = this.vm.run(instrs);
        return result;
    }

    async evaluateChunk(chunk: string) {
        const result = this.parse_compile_run(chunk);
        console.log(`Result of expression: ${result}`);
    }
}
