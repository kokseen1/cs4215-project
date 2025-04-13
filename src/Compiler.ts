import { has_copy_trait, has_move_trait, Traits } from './Traits';
import { pprint, error, display, push, peek, is_boolean, is_null, is_number, is_string, is_undefined, arity, lookup_type } from './Utils';
import { SimpleLangParser } from "./parser/src/SimpleLangParser";

export class Compiler {
    private instrs = [];
    private wc = 0;
    private global_compile_environment
    private ce_size_bef_fun = -1;
    private builtin_compile_frame
    private constant_compile_frame

    constructor(builtins, constants) {
        this.builtin_compile_frame = Object.keys(builtins)
        this.constant_compile_frame = Object.keys(constants)
        this.global_compile_environment =
            [this.builtin_compile_frame, this.constant_compile_frame]
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

    private get_symbol = (x) =>
        typeof x === 'string'// for builtins and constants
            ? x
            : typeof x === 'object' // let, fun, and param types will store entire comp object
                ? x.sym || error("Symbol is undefined")
                : error("Error: cannot get symbol for " + x)


    // returns the 0-based index of the symbol in the frame
    private get_value_index = (frame: any[], x: string) => {
        for (let i = 0; i < frame.length; i++) {
            if (this.get_symbol(frame[i]) === x)
                return i;
        }
        // value does not exist in frame
        return -1;
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


    private gain_ownership = (ce, comp) => {
        // if (comp.ref === true)
        //     error("Reference cannot gain ownership")
        const sym = this.get_symbol(comp)
        const ctv = this.get_compile_time_value(ce, sym);
        ctv.owner = true;
        console.log(sym + " gained ownership");
    }

    private basic_lose = (ce, comp) => {
        // if (comp.ref === true)
        //     error("Reference cannot lose ownership")
        const sym = this.get_symbol(comp)
        const ctv = this.get_compile_time_value(ce, sym);
        if (ctv.owner === false)
            error(sym + " is already moved")
        ctv.owner = false;
        console.log(sym + " lost ownership");
    }

    private get_cte_type = (ce, sym) => {
        const ctv = this.get_compile_time_value(ce, sym);
        return ctv.type;
    }

    private set_cte_type = (ce, sym, type) => {
        const ctv = this.get_compile_time_value(ce, sym);
        ctv.type = type;
    }

    private binop_lose = (ce, comp) => {
        // TODO: ensure working for recursive nested binop
        const frst = comp.frst;
        const scnd = comp.scnd;
        this.lose_ownership(ce, frst);
        this.lose_ownership(ce, scnd);
    }

    private lose_ownership = (ce, comp) => {
        switch (comp.tag) {
            case 'nam':
            case 'fun':
                this.basic_lose(ce, comp);
                break;
            case 'binop':
                this.binop_lose(ce, comp);
                break;
            case 'unop':
                // TODO: lose for unop
                break;
            // cases such as 'lit' do not need to lose ownership
            default:
                break;
        }
    }

    private move_ownership = (ce, from, to) => {
        // TODO: need to free if it was already owning something (mutated)
        // might be possible to compile a drop instruction right here
        // e.g.:
        // let mut x = String::from("asd");
        // let y = String::from("asd");
        // insert DROP (x)
        // let x = y;
        // only move for valid types (nam, fun) but not (lit)

        // lose first then gain back, to handle `x = x - 1;`
        this.lose_ownership(ce, from)
        this.gain_ownership(ce, to)
        console.log("moved owner from " +
            (from.val || from.fun?.sym || from.sym) + " (" + from.tag + ") to " + this.get_symbol(to))
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


    private compile_comp = {
        lit:
            (comp, ce) => {
                this.instrs[this.wc++] = {
                    tag: "LDC",
                    val: comp.val
                }
                comp.inferred_type = lookup_type(comp.val);
            },
        nam:
            // store precomputed position information in LD instruction
            (comp, ce) => {
                const ctv = this.get_compile_time_value(ce, comp.sym);
                if (ctv.owner === false)
                    error("Error: use of moved value " + comp.sym);
                comp.inferred_type = ctv.type;

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
                comp.inferred_type = comp.fun.inferred_type
                for (let arg of comp.args) {
                    this.compile(arg, ce)
                    // don't lose ownership to builtins
                    if (!this.builtin_compile_frame.includes(comp.fun.sym) &&
                        has_move_trait(arg.inferred_type)) {
                        this.lose_ownership(ce, arg)
                    }
                }
                this.instrs[this.wc++] = { tag: 'CALL', arity: comp.args.length }
                pprint(comp)
                if (has_move_trait(comp.fun.inferred_type)) {
                    // free function application statements without assignments
                    this.instrs[this.wc++] = { tag: 'DROP_POP' }
                }
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

                const expr_type = comp.expr.inferred_type;
                if (has_move_trait(expr_type)) {
                    this.move_ownership(ce, comp.expr, comp);
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
                const extended_ce = this.compile_time_environment_extend(
                    comp.prms.map(this.make_cte_object), ce);
                for (const prm of comp.prms) {
                    const type = prm.type.type;
                    this.set_cte_type(extended_ce, prm.sym, type);
                    if (has_move_trait(type) && prm.type.ref !== true)
                        this.gain_ownership(extended_ce, prm)
                }
                this.compile(comp.body, extended_ce)

                const drop_instr = this.instrs[this.wc - 2];
                // update DROP instruction with function parameters
                // assumes that all functions are blocks
                drop_instr.to_free = drop_instr.to_free.concat(
                    this.get_droppable_positions(ce.length, extended_ce))

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
        let:
            (comp, ce) => {
                this.compile(comp.expr, ce)
                this.instrs[this.wc++] = {
                    tag: 'ASSIGN',
                    pos: this.compile_time_environment_position(
                        ce, comp.sym)
                }

                // expr type must have already been inferred at this point
                const expr_type = comp.expr.inferred_type;
                this.set_cte_type(ce, comp.sym, expr_type)
                if (has_move_trait(expr_type)) {
                    this.move_ownership(ce, comp.expr, comp);
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
                const expr_type = comp.expr.inferred_type;
                if (has_move_trait(expr_type)) {
                    // lose ownership, pass to caller
                    this.lose_ownership(ce, comp.expr)
                }
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
                this.set_cte_type(ce, comp.sym, comp.retType.type)
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

    // Should only be used for declarations
    private make_cte_object = (comp) => {
        // let rhs_type;
        // switch (comp.tag) {
        //     case "let":
        //     case "const":
        //         rhs_type = get_expr_type(comp.expr);
        //         break;
        //     case "fun":
        //         rhs_type = comp.retType.type;
        //         // should work if type checker implements fun
        //         // rhs_type = get_expr_type(comp.expr);
        //         break;
        //     default:
        //         error("not a declaration: " + comp)
        // }

        // pprint("comp")
        // pprint(comp)
        // pprint(rhs_type)
        if (comp.sym === undefined)
            error("Object " + comp + " does not have symbol")
        return {
            sym: comp.sym,
            owner: undefined
        }
    }

    private scan = comp =>
        comp.tag === 'seq'
            ? comp.stmts.reduce((acc, x) => acc.concat(this.scan(x)),
                [])
            : ['let', 'const', 'fun'].includes(comp.tag)
                ? [this.make_cte_object(comp)] // store object instead of string
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