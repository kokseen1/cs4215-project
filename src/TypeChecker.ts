import { push, error} from './Utils';

export class TypeChecker {
    constructor() {}

    private type_environment_extend = (te, items) => {
        const _te = { ...te }
        for (const key of items) {
            _te[key] = {}
        }
        return _te
    }

    private type_comp = {
        lit:
            (comp, te) => {
            },
        nam:
            (comp, te) => {
            },
        unop:
            (comp, te) => {
                this.type(comp.frst, te)
            },
        binop:
            (comp, te) => {
                this.type(comp.frst, te)
                this.type(comp.scnd, te)
            },
        log:
            (comp, te) => {
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
                    te)
            },
        cond:
            (comp, te) => {
                this.type(comp.pred, te)
                this.type(comp.cons, te)
                this.type(comp.alt, te)
            },
        while:
            (comp, te) => {
                this.type(comp.pred, te)
                this.type(comp.body, te)
            },
        app:
            (comp, te) => {
                this.type(comp.fun, te)
                for (let arg of comp.args) {
                    this.type(arg, te)
                }
            },
        assmt:
            (comp, te) => {
                
                // error if var is OUT OF SCOPE
                if (!(comp.sym in te)) {
                    error("cannot find value `" + comp.sym + "` in this scope")
                }   

                // error if var is IMMUTABLE    
                if (te[comp.sym]["mut"] !== true) {
                    error("cannot assign twice to immutable variable `" + comp.sym + "`")
                }
                this.type(comp.expr, te)
            },
        lam:
            (comp, te) => {
                this.type(
                    comp.body,
                    this.type_environment_extend(te, comp.prms)
                )
            },
        seq:
            (comp, te) => this.type_sequence(comp.stmts, te),
        blk:
            (comp, te) => {
                const locals = this.scan(comp.body)
                this.type(
                    comp.body,
                    this.type_environment_extend(te, locals)
                )

                // TODO: once done with block, should `free` allocated locals!
                console.log("TO FREE: ", locals)

            },
        let:
            (comp, te) => {
                te[comp.sym]["mut"] = comp.mut
                this.type(comp.expr, te)
            },
        const:
            (comp, te) => {
                this.type(comp.expr, te)
            },
        ret:
            (comp, te) => {
                this.type(comp.expr, te)
            },
        fun:
            (comp, te) => {
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
                    te)
            }
    }

    private type_sequence = (seq, te) => {
        let first = true
        for (let comp of seq) {
            this.type(comp, te)
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
    private type = (comp, te) => {
        //console.log(comp.tag, te)
        this.type_comp[comp.tag](comp, te)
    };

    // type program into instruction array instrs,
    // after initializing wc and instrs
    public type_program = (program) => {
        let type_env = {}
        this.type(program, type_env)
        return true
    };
}