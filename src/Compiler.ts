import { SimpleLangParser } from "./parser/src/SimpleLangParser";

export class Compiler {
    private instrs = [];
    private wc = 0;

    constructor() {
    }

    private compile_comp = {
        lit:
            comp => {
                this.instrs[this.wc++] = { tag: "LDC", val: comp.val }
            },
        nam:
            comp => {
                this.instrs[this.wc++] = { tag: "LD", sym: comp.sym }
            },
        unop:
            comp => {
                this.compile(comp.frst)
                this.instrs[this.wc++] = { tag: 'UNOP', sym: comp.sym }
            },
        binop:
            comp => {
                this.compile(comp.frst)
                this.compile(comp.scnd)
                this.instrs[this.wc++] = { tag: 'BINOP', sym: comp.sym }
            },
        log:
            comp => {
                this.compile(comp.sym == SimpleLangParser.AND
                    ? {
                        tag: 'cond',
                        pred: comp.frst,
                        cons: comp.scnd,
                        alt: { tag: 'lit', val: false }
                    }
                    : {
                        tag: 'cond',
                        pred: comp.frst,
                        cons: { tag: 'lit', val: true },
                        alt: comp.scnd
                    })
            },
        cond:
            comp => {
                this.compile(comp.pred)
                const jump_on_false_instruction = { tag: 'JOF', addr: undefined }
                this.instrs[this.wc++] = jump_on_false_instruction
                this.compile(comp.cons)
                const goto_instruction = { tag: 'GOTO', addr: undefined }
                this.instrs[this.wc++] = goto_instruction;
                const alternative_address = this.wc;
                jump_on_false_instruction.addr = alternative_address;
                this.compile(comp.alt)
                goto_instruction.addr = this.wc
            },
        app:
            comp => {
                this.compile(comp.fun)
                for (let arg of comp.args) {
                    this.compile(arg)
                }
                this.instrs[this.wc++] = { tag: 'CALL', arity: comp.args.length }
            },
        assmt:
            comp => {
                this.compile(comp.expr)
                this.instrs[this.wc++] = { tag: 'ASSIGN', sym: comp.sym }
            },
        lam:
            comp => {
                this.instrs[this.wc++] = { tag: 'LDF', prms: comp.prms, addr: this.wc + 1 };
                // jump over the body of the lambda expression
                const goto_instruction = { tag: 'GOTO', addr: undefined}
                this.instrs[this.wc++] = goto_instruction
                this.compile(comp.body)
                this.instrs[this.wc++] = { tag: 'LDC', val: undefined }
                this.instrs[this.wc++] = { tag: 'RESET' }
                goto_instruction.addr = this.wc;
            },
        seq:
            comp => this.compile_sequence(comp.stmts),
        blk:
            comp => {
                const locals = this.scan(comp.body)
                this.instrs[this.wc++] = { tag: 'ENTER_SCOPE', syms: locals }
                this.compile(comp.body)
                this.instrs[this.wc++] = { tag: 'EXIT_SCOPE' }
            },
        let:
            comp => {
                this.compile(comp.expr)
                this.instrs[this.wc++] = { tag: 'ASSIGN', sym: comp.sym }
            },
        const:
            comp => {
                this.compile(comp.expr)
                this.instrs[this.wc++] = { tag: 'ASSIGN', sym: comp.sym }
            },
        ret:
            comp => {
                this.compile(comp.expr)
                if (comp.expr.tag === 'app') {
                    // tail call: turn CALL into TAILCALL
                    this.instrs[this.wc - 1].tag = 'TAIL_CALL'
                } else {
                    this.instrs[this.wc++] = { tag: 'RESET' }
                }
            },
        fun:
            comp => {
                this.compile(
                    {
                        tag: 'const',
                        sym: comp.sym,
                        expr: { tag: 'lam', prms: comp.prms, body: comp.body }
                    })
            }
    }
    private compile_sequence = seq => {
        if (seq.length === 0)
            return this.instrs[this.wc++] = { tag: "LDC", val: undefined }
        let first = true
        for (let comp of seq) {
            first ? first = false
                : this.instrs[this.wc++] = { tag: 'POP' }
            this.compile(comp)
        }
    }


    private scan = comp =>
        comp.tag === 'seq'
            ? comp.stmts.reduce((acc, x) => acc.concat(this.scan(x)),
                [])
            : ['let', 'const', 'fun'].includes(comp.tag)
                ? [comp.sym]
                : []

    private compile = comp => {
        this.compile_comp[comp.tag](comp)
        this.instrs[this.wc] = { tag: 'DONE' }
    }

    // this.compile program into instruction array this.instrs, 
    // after initializing this.wc and this.instrs
    public compile_program = program => {
        this.wc = 0
        this.instrs = []
        this.compile(program)
        return this.instrs;
    }
}
