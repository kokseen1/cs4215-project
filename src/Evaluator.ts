import { CharStream, CommonTokenStream } from 'antlr4ng';
import { DustLexer } from './parser/src/DustLexer';
import { DustParser } from './parser/src/DustParser';
import { DustEvaluatorVisitor } from './EvaluatorVisitor';
import { VirtualMachine } from './VirtualMachine';
import { Compiler } from './Compiler';
import { TypeChecker } from './TypeChecker';

export class DustEvaluator {
    public visitor: DustEvaluatorVisitor;
    public typeChecker: TypeChecker;
    public compiler: Compiler;
    public vm: VirtualMachine;

    constructor() {
        this.visitor = new DustEvaluatorVisitor();
    }

    public evaluate(chunk, custom_builtins={}) {
        const inputStream = CharStream.fromString(chunk);
        const lexer = new DustLexer(inputStream);
        const tokenStream = new CommonTokenStream(lexer);
        const parser = new DustParser(tokenStream);

        // Parse the input
        const tree = parser.prog();

        // Convert the parsed tree into a json-like format
        const prog = this.visitor.visit(tree);

        // Instantiate the TypeChecker
        this.typeChecker = new TypeChecker();

        // Instantiate the VM
        this.vm = new VirtualMachine(custom_builtins);

        // Instantiate the compiler
        this.compiler =
            new Compiler(this.vm.get_builtins(), this.vm.get_constants());

        // Type check the program
        const [is_success, checked_prog] =
            this.typeChecker.type_program(prog);

        // Compile the program
        const [instrs, ownership_dag] =
            this.compiler.compile_program(prog);

        // Print the instructions
        // instrs.map((e, i) => {
        //     process.stdout.write(i + ": ")
        //     console.dir(e, { depth: null });
        // })

        // Evaluate the instructions
        const result = this.vm.run(instrs);

        return [result, ownership_dag];
    }
}
