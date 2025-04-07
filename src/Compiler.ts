import { pprint, error, display, push, peek, is_boolean, is_null, is_number, is_string, is_undefined, arity } from './Utils';
import { SimpleLangParser } from "./parser/src/SimpleLangParser";

export class Compiler {
    private instrs = [];
    private wc = 0;
    private global_compile_environment
    private ce_size_bef_fun = -1;

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

    private get_compile_time_value = (env, x) => {
        const [frame_index, value_index] =
            this.compile_time_environment_position(env, x)
        return env[frame_index][value_index];
    }


    // find the position [frame-index, value-index] 
    // of a given symbol x
    private compile_time_environment_position = (env, x) => {
        // console.log(env)
        for (let frame_index = env.length - 1; frame_index >= 0; frame_index--) {
            const value_index = this.get_value_index(env[frame_index], x);
            if (value_index !== -1) {
                return [frame_index, value_index]
            }
        }
        // cannot find symbol in environment
        error("Error: cannot find symbol: " + x)
    }

    private compile_time_environment_extend = (vs, e) => {
        //  make shallow copy of e
        return push([...e], vs)
    }

    private get_symbol = (x) =>
        typeof x === 'string'// for builtins and constants
            ? x
            : (typeof x === 'object') // let, fun, and param types will store entire comp object
                ? x.sym
                : error("Error: cannot get symbol")

    // returns the 0-based index of the symbol in the frame
    private get_value_index = (frame: any[], x: string) => {
        for (let i = 0; i < frame.length; i++) {
            if (this.get_symbol(frame[i]) === x)
                return i;
        }
        // value does not exist in frame
        return -1;
    }

    private lose_ownership = (ce, comp) => {
        if (comp.ref === true)
            error("Reference cannot lose ownership")
        if (comp.sym !== undefined) {
            const rhs = this.get_compile_time_value(ce, comp.sym);
            rhs.owner = false;
        }
        console.log(comp.sym + " lost ownership");
    }

    private move_ownership = (ce, comp) => {
        const lhs = this.get_compile_time_value(ce, comp.sym);
        lhs.owner = true; // need to free if it was already owning something
        // only move for valid types (nam, fun) but not (lit)
        if (comp.expr.sym !== undefined) {
            const rhs = this.get_compile_time_value(ce, comp.expr.sym);
            if (rhs.owner === false) error(comp.expr.sym + " is already moved");
            rhs.owner = false;
        }
        console.log("move owner from " + (comp.expr.val || comp.expr.sym) + " to " + comp.sym)
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
                const ctv = this.get_compile_time_value(ce, comp.sym);
                if (ctv.owner === false)
                    error("Error: use of moved value " + comp.sym);
                if (comp.is_arg === true && comp.ref !== true)
                    this.lose_ownership(ce, comp)
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
                this.move_ownership(ce, comp);
            },
        let:
            (comp, ce) => {
                this.compile(comp.expr, ce)
                this.instrs[this.wc++] = {
                    tag: 'ASSIGN',
                    to: comp.sym,
                    pos: this.compile_time_environment_position(
                        ce, comp.sym)
                }
                this.move_ownership(ce, comp);
                // pprint(ce)
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
                this.ce_size_bef_fun = ce.length;
                // extend compile-time environment
                const prms = comp.prms.map(p =>
                    // take ownership if not borrowing
                    this.set_ownership(p, p.type.ref === false))
                const extended_ce = this.compile_time_environment_extend(
                    prms, ce);
                this.compile(comp.body, extended_ce)
                // pprint(extended_ce)
                const drop_instr = this.instrs[this.wc - 2];
                // update DROP instruction with function parameters
                drop_instr.to_free =
                    drop_instr.to_free.concat(this.get_droppable_positions(ce.length, extended_ce))
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
                // extend compile-time environment
                const extended_ce = this.compile_time_environment_extend(locals, ce);
                this.compile(comp.body, extended_ce)
                this.generate_drop_instr(ce.length, extended_ce);
                this.instrs[this.wc++] = { tag: 'EXIT_SCOPE' }
            },
        ret:
            (comp, ce) => {
                this.compile(comp.expr, ce)
                this.generate_drop_instr(this.ce_size_bef_fun, ce);
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

    private get_droppable_positions = (ce_idx: number, ce) => {
        if (ce_idx === -1)
            error("Error: unable to get droppable positions")
        const positions = [];
        for (let i = ce_idx; i < ce.length; i++) {
            const frame = ce[i];
            for (const value of frame) {
                if (value.owner === true) {
                    const sym = this.get_symbol(value);
                    positions.push({
                        sym: sym,
                        pos: this.compile_time_environment_position(ce, sym)
                    })
                }
            }
        }
        return positions;
    }

    private make_drop_instr = (ce_idx: number, ce) => {
        return {
            tag: 'DROP',
            to_free: this.get_droppable_positions(ce_idx, ce)
        }
    }

    private generate_drop_instr = (ce_idx: number, ce) =>
        this.instrs[this.wc++] = this.make_drop_instr(ce_idx, ce)


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

    private set_ownership = (obj: any, b: boolean) => {
        if (typeof obj === 'object')
            obj.owner = b;
        return obj;
    }

    private scan = comp =>
        comp.tag === 'seq'
            ? comp.stmts.reduce((acc, x) => acc.concat(this.scan(x)),
                [])
            : ['let', 'const', 'fun'].includes(comp.tag)
                ? [comp] // store entire comp object
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
