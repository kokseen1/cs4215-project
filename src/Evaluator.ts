import { CharStream, CommonTokenStream } from 'antlr4ng';
import { SimpleLangLexer } from './parser/src/SimpleLangLexer';
import { SimpleLangParser } from './parser/src/SimpleLangParser';
import { SimpleLangEvaluatorVisitor } from './EvaluatorVisitor';
import { VirtualMachine } from './VirtualMachine';
import { Compiler } from './Compiler';
import { TypeChecker } from './TypeChecker';
import { pprint, to_diagon } from './Utils';
import { resourceLimits } from 'worker_threads';

export class SimpleLangEvaluator {
    public visitor: SimpleLangEvaluatorVisitor;
    public typeChecker: TypeChecker;
    public compiler: Compiler;
    public vm: VirtualMachine;
    public diagon;

    constructor() {
        this.visitor = new SimpleLangEvaluatorVisitor();
    }

    async init() {
        const Diagon = await import("diagonjs");
        this.diagon = await Diagon.init();
    }

    public parse_compile_run(chunk, visualize_ownership) {
        const inputStream = CharStream.fromString(chunk);
        const lexer = new SimpleLangLexer(inputStream);
        const tokenStream = new CommonTokenStream(lexer);
        const parser = new SimpleLangParser(tokenStream);

        // Parse the input
        const tree = parser.prog();

        // Convert the parsed tree into a json-like format
        const prog = this.visitor.visit(tree);
        //console.log(JSON.stringify(prog));

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
        const [instrs, ownership_dag] =
            this.compiler.compile_program(prog);
        

        let diagon_dag;
        if (visualize_ownership) {
            diagon_dag = this.diagon.translate.graphDAG(
                to_diagon(ownership_dag)) || "no ownership moved";
        }

        // Print the instructions
        // instrs.map((e, i) => {
        //     process.stdout.write(i + ": ")
        //     console.dir(e, { depth: null });
        // })

        // Evaluate the instructions
        const result = this.vm.run(instrs);
        return [result, diagon_dag];
    }

    async evaluateChunk(chunk: string) {
        await this.init();
        const [result, diagon_dag] = this.parse_compile_run(chunk, false);
        console.log(`Result of expression: ${result}`);
        if (diagon_dag) {
            console.log("Ownership visualization:");
            console.log(diagon_dag);
        }
    }

    async testChunk(chunk: string, visualize_ownership) {
        try {
            await this.init()
            return this.parse_compile_run(chunk, visualize_ownership)
        } catch (e) {
            return [e + "", false]
        }
    }
}
