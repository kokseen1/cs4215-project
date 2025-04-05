import { error, display, push, peek, is_boolean, is_null, is_number, is_string, is_undefined, arity } from './Utils';
import { SimpleLangParser } from "./parser/src/SimpleLangParser";

export class Compiler {
    private instrs = [];
    private wc = 0;
    private global_compile_environment

    constructor(builtins, constants) {
        const builtin_compile_frame = Object.keys(builtins)
        const constant_compile_frame = Object.keys(constants)
        this.global_compile_environment =
            [builtin_compile_frame, constant_compile_frame]
    }

    // ************************
    // compile-time environment
    // ************************/

    // a compile-time environment is an array of 
    // compile-time frames, and a compile-time frame 
    // is an array of symbols

    // find the position [frame-index, value-index] 
    // of a given symbol x
    private compile_time_environment_position = (env, x) => {
        let frame_index = env.length
        while (this.value_index(env[--frame_index], x) === -1) { }
        return [frame_index,
            this.value_index(env[frame_index], x)]
    }

    private compile_time_environment_extend = (vs, e) => {
        //  make shallow copy of e
        return push([...e], vs)
    }

    private value_index = (frame, x) => {
        for (let i = 0; i < frame.length; i++) {
            if (typeof frame[i] === 'string' && frame[i] === x)
                return i;
            else if (typeof frame[i] === 'object' && frame[i].id === x)
                return i;
        }
        return -1;
    }

    private compile_comp = {
        lit:
            (comp, ce) => {
                this.instrs[this.wc++] = {
                    tag: "LDC",
                    val: comp.val
                }
            },
        nam:
            // store precomputed position information in LD instruction
            (comp, ce) => {
                this.instrs[this.wc++] = {
                    tag: "LD",
                    sym: comp.sym,
                    pos: this.compile_time_environment_position(
                        ce, comp.sym)
                }
            },
        unop:
            (comp, ce) => {
                this.compile(comp.frst, ce)
                this.instrs[this.wc++] = { tag: 'UNOP', sym: comp.sym }
            },
        binop:
            (comp, ce) => {
                this.compile(comp.frst, ce)
                this.compile(comp.scnd, ce)
                this.instrs[this.wc++] = { tag: 'BINOP', sym: comp.sym }
            },
        log:
            (comp, ce) => {
                this.compile(comp.sym == '||'
                    ? {
                        tag: 'cond_expr',
                        pred: comp.frst,
                        cons: { tag: 'lit', val: true },
                        alt: comp.scnd
                    }
                    : {
                        tag: 'cond_expr',
                        pred: comp.frst,
                        cons: comp.scnd,
                        alt: { tag: 'lit', val: false }
                    },
                    ce)
            },
        cond:
            (comp, ce) => {
                this.compile(comp.pred, ce)
                const jump_on_false_instruction: any = { tag: 'JOF' }
                this.instrs[this.wc++] = jump_on_false_instruction
                this.compile(comp.cons, ce)
                const goto_instruction: any = { tag: 'GOTO' }
                this.instrs[this.wc++] = goto_instruction;
                const alternative_address = this.wc;
                jump_on_false_instruction.addr = alternative_address;
                this.compile(comp.alt, ce)
                goto_instruction.addr = this.wc
            },
        while:
            (comp, ce) => {
                const loop_start = this.wc
                this.compile(comp.pred, ce)
                const jump_on_false_instruction: any = { tag: 'JOF' }
                this.instrs[this.wc++] = jump_on_false_instruction
                this.compile(comp.body, ce)
                this.instrs[this.wc++] = { tag: 'POP' }
                this.instrs[this.wc++] = { tag: 'GOTO', addr: loop_start }
                jump_on_false_instruction.addr = this.wc
                this.instrs[this.wc++] = { tag: 'LDC', val: undefined }
            },
        app:
            (comp, ce) => {
                this.compile(comp.fun, ce)
                for (let arg of comp.args) {
                    this.compile(arg, ce)
                }
                this.instrs[this.wc++] = { tag: 'CALL', arity: comp.args.length }
            },
        assmt:
            // store precomputed position info in ASSIGN instruction
            (comp, ce) => {
                this.compile(comp.expr, ce)
                this.instrs[this.wc++] = {
                    tag: 'ASSIGN',
                    pos: this.compile_time_environment_position(
                        ce, comp.sym)
                }
            },
        lam:
            (comp, ce) => {
                this.instrs[this.wc++] = {
                    tag: 'LDF',
                    arity: comp.arity,
                    addr: this.wc + 1
                };
                // jump over the body of the lambda expression
                const goto_instruction: any = { tag: 'GOTO' }
                this.instrs[this.wc++] = goto_instruction
                // extend compile-time environment
                this.compile(comp.body,
                    this.compile_time_environment_extend(
                        comp.prms, ce))
                this.instrs[this.wc++] = { tag: 'LDC', val: undefined }
                this.instrs[this.wc++] = { tag: 'RESET' }
                goto_instruction.addr = this.wc;
            },
        seq:
            (comp, ce) => this.compile_sequence(comp.stmts, ce),
        blk:
            (comp, ce) => {
                const locals = this.scan(comp.body)
                this.instrs[this.wc++] = { tag: 'ENTER_SCOPE', num: locals.length }
                this.compile(comp.body,
                    // extend compile-time environment
                    this.compile_time_environment_extend(
                        locals, ce))
                this.instrs[this.wc++] = { tag: 'EXIT_SCOPE' }
            },
        let:
            (comp, ce) => {
                this.compile(comp.expr, ce)
                this.instrs[this.wc++] = {
                    tag: 'ASSIGN',
                    pos: this.compile_time_environment_position(
                        ce, comp.sym)
                }
            },
        const:
            (comp, ce) => {
                this.compile(comp.expr, ce)
                this.instrs[this.wc++] = {
                    tag: 'ASSIGN',
                    pos: this.compile_time_environment_position(
                        ce, comp.sym)
                }
            },
        ret:
            (comp, ce) => {
                this.compile(comp.expr, ce)
                if (comp.expr.tag === 'app') {
                    // tail call: turn CALL into TAILCALL
                    this.instrs[this.wc - 1].tag = 'TAIL_CALL'
                } else {
                    this.instrs[this.wc++] = { tag: 'RESET' }
                }
            },
        fun:
            (comp, ce) => {
                this.compile(
                    {
                        tag: 'const',
                        sym: comp.sym,
                        expr: {
                            tag: 'lam',
                            prms: comp.prms,
                            body: comp.body
                        }
                    },
                    ce)
            }
    }

    private compile_sequence = (seq, ce) => {
        if (seq.length === 0)
            return this.instrs[this.wc++] = { tag: "LDC", val: undefined }
        let first = true
        for (let comp of seq) {
            first ? first = false
                : this.instrs[this.wc++] = { tag: 'POP' }
            this.compile(comp, ce)
        }
    }


    private scan = comp =>
        comp.tag === 'seq'
            ? comp.stmts.reduce((acc, x) => acc.concat(this.scan(x)),
                [])
            : ['let', 'const', 'fun'].includes(comp.tag)
                ? [comp.sym]
                : []

    // compile component into instruction array instrs,
    // starting at wc (write counter)
    private compile = (comp, ce) => {
        this.compile_comp[comp.tag](comp, ce);
    };

    // compile program into instruction array instrs,
    // after initializing wc and instrs
    public compile_program = (program) => {
        this.wc = 0;
        this.instrs = [];
        this.compile(program, this.global_compile_environment);
        this.instrs[this.wc] = { tag: "DONE" };
        return this.instrs
    };
}
