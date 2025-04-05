import { push, error} from './Utils';

export class TypeChecker {
    private global_type_environment
    
    private type_dict = {} // fake env, need to change to real env for scoping!!

    constructor(builtins, constants) {
        const builtin_type_frame = Object.keys(builtins)
        const constant_type_frame = Object.keys(constants)
        this.global_type_environment =
            [builtin_type_frame, constant_type_frame]
    }

    // ************************
    // type-time environment
    // ************************/

    // a type-time environment is an array of 
    // type-time frames, and a type-time frame 
    // is an array of symbols

    private type_environment_extend = (vs, e) => {
        //  make shallow copy of e
        return push([...e], vs)
    }

    private type_comp = {
        lit:
            (comp, ce) => {
            },
        nam:
            // store precomputed position information in LD instruction
            (comp, ce) => {
            },
        unop:
            (comp, ce) => {
                this.type(comp.frst, ce)
            },
        binop:
            (comp, ce) => {
                this.type(comp.frst, ce)
                this.type(comp.scnd, ce)
            },
        log:
            (comp, ce) => {
                this.type(comp.sym == '||'
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
                this.type(comp.pred, ce)
                this.type(comp.cons, ce)
                this.type(comp.alt, ce)
            },
        while:
            (comp, ce) => {
                this.type(comp.pred, ce)
                this.type(comp.body, ce)
            },
        app:
            (comp, ce) => {
                this.type(comp.fun, ce)
                for (let arg of comp.args) {
                    this.type(arg, ce)
                }
            },
        assmt:
            (comp, ce) => {

                // error if var is IMMUTABLE
                if (this.type_dict[comp.sym] !== comp.mut) {
                    error("cannot assign twice to immutable variable `" + comp.sym + "`")
                }

                this.type(comp.expr, ce)
            },
        lam:
            (comp, ce) => {
                // extend type-time environment
                this.type(comp.body,
                    this.type_environment_extend(
                        comp.prms, ce))
            },
        seq:
            (comp, ce) => this.type_sequence(comp.stmts, ce),
        blk:
            (comp, ce) => {
                const locals = this.scan(comp.body)
                this.type(comp.body,
                    // extend type-time environment
                    this.type_environment_extend(
                        locals, ce))
            },
        let:
            (comp, ce) => {
                this.type_dict[comp.sym] = comp.mut
                this.type(comp.expr, ce)
            },
        const:
            (comp, ce) => {
                this.type(comp.expr, ce)
            },
        ret:
            (comp, ce) => {
                this.type(comp.expr, ce)
            },
        fun:
            (comp, ce) => {
                this.type(
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

    private type_sequence = (seq, ce) => {
        let first = true
        for (let comp of seq) {
            this.type(comp, ce)
        }
    }


    private scan = comp =>
        comp.tag === 'seq'
            ? comp.stmts.reduce((acc, x) => acc.concat(this.scan(x)),
                [])
            : ['let', 'const', 'fun'].includes(comp.tag)
                ? [comp.sym]
                : []

    // type component into instruction array instrs,
    // starting at wc (write counter)
    private type = (comp, ce) => {
        this.type_comp[comp.tag](comp, ce);
    };

    // type program into instruction array instrs,
    // after initializing wc and instrs
    public type_program = (program) => {
        this.type(program, this.global_type_environment);
        return true
    };
}