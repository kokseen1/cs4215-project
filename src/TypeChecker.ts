import { error, is_number, is_boolean, is_string, is_undefined, pair, head, tail, is_null, pprint } from './Utils';

export class TypeChecker {
    constructor() {}

    // turn a given type into a string
    // Example:
    // unparse_type({"tag": "fun", 
    //               "args": ["number", "number"], 
    //               "res": "bool"})
    // returns
    // "(number, number > bool)"
    private unparse_types = ts =>
        ts.length === 0 
        ? "null"
        : ts.reduce((s, t) => s === "" 
                            ? this.unparse_type(t) 
                            : s + ", " + this.unparse_type(t), "")
    private unparse_type = t =>
        is_string(t) 
        ? t 
        : // t is function type
        "(" + this.unparse_types(t.args) + " > " + 
        this.unparse_type(t.res) + ")"
    
    private equal_types = (ts1, ts2) =>
        this.unparse_types(ts1) === this.unparse_types(ts2)
        
    private equal_type = (t1, t2) =>
        this.unparse_type(t1) === this.unparse_type(t2)

    /* *****************
    * type environments
    * *****************/

    // Type frames are JavaScript objects that map 
    // symbols (strings) to types.
    private unary_arith_type =
        { tag: "fun", args: ["number"], 
        res: "number" }
        
    private binary_arith_type =
        { tag: "fun", args: ["number", "number"], 
        res: "number" }

    private number_comparison_type =
        { tag: "fun", args: ["number", "number"], 
        res: "bool" }

    private binary_bool_type =
        { tag: "fun", args: ["bool"], 
        res: "bool" }
        
    private unary_bool_type =
        { tag: "fun", args: ["bool"], 
        res: "bool" }
        
    private global_type_frame = {
        "undefined": "undefined",
        math_E: "number",
        math_PI: "number",
        math_sin: this.unary_arith_type,
        "+": this.binary_arith_type,
        "-": this.binary_arith_type,
        "*": this.binary_arith_type,
        "/": this.binary_arith_type,
        "<": this.number_comparison_type,
        ">": this.number_comparison_type,
        "<=": this.number_comparison_type,
        ">=": this.number_comparison_type,
        "===": this.number_comparison_type,
        "&&": this.binary_bool_type,
        "||": this.binary_bool_type,
        "-unary": this.unary_arith_type,
        "!": this.unary_bool_type
    }

    // A type environment is null or a pair 
    // whose head is a frame and whose tail 
    // is a type environment.
    private empty_type_environment = null
    private global_type_environment = pair(this.global_type_frame, this.empty_type_environment)

    // returns `void` if type is unspecified
    private get_type = (type_info) => {
        return typeof type_info === "object" && "type" in type_info ? type_info.type : type_info
    }

    private lookup_field = (field, x, e) => {
        return is_null(e)
        ? error("unbound name: " + x)
        : head(e).hasOwnProperty(x) 
        ? head(e)[x][field]
        : this.lookup_field(field, x, tail(e))
    }

    private update_field = (field, x, val, e) => {
        return is_null(e)
        ? error("unbound name: " + x)
        : head(e).hasOwnProperty(x)
        ? head(e)[x][field] = val
        : this.update_field(field, x, val, tail(e));
    }

    private iterate_type_environment = (te) => {
        if (head(te).hasOwnProperty("undefined")) { return }
        pprint(head(te))
        return this.iterate_type_environment(tail(te))
    }

    private deep_copy_type_environment = (te) => {
        if (is_null(te)) {
            return null;
        }
        return pair(
            structuredClone(head(te)), // deep copy frame
            this.deep_copy_type_environment(tail(te))
        );
    };

    private extend_type_environment = (xs, ts, e) => {
        if (ts.length > xs.length) 
            error('too few parameters in function declaration')
        if (ts.length < xs.length) 
            error('too many parameters in function declaration')
        const new_frame = {}
        for (let i = 0; i < xs.length; i++) 
            new_frame[xs[i]] = ts[i]
        return pair(new_frame, e)
    }

    // type_comp has the typing
    // functions for each component tag
    private type_comp = {
        lit:
            (comp, te) => is_number(comp.val) 
                        ? "i32"
                        : is_boolean(comp.val)
                        ? "bool"
                        : is_undefined(comp.val)
                        ? "undefined"
                        : error("unknown literal: " + comp.val),
        nam:
            (comp, te) => this.lookup_field("type", comp.sym, te),
        unop:
            (comp, te) => this.type({tag: 'app',
                                fun: {tag: 'nam', sym: comp.sym},
                                args: [comp.frst]}, te),
        binop:
            (comp, te) => this.type({tag: 'app',
                                fun: {tag: 'nam', sym: comp.sym},
                                args: [comp.frst, comp.scnd]}, te),
        log:
            (comp, te) => this.type({tag: 'app',
                                fun: {tag: 'nam', sym: comp.sym},
                                args: [comp.frst, comp.scnd]}, te),
        cond_expr: 
            (comp, te) => {
                const t0 = this.type(comp.pred, te)
                if (t0 !== "bool") 
                    error("expected predicate type: bool, " +
                        "actual predicate type: " + 
                        this.unparse_type(t0))
                const t1 = this.type(comp.cons, te)
                const t2 = this.type(comp.alt, te)
                if (this.equal_type(t1, t2)) {
                    return t1
                } else {
                    error("types of branches not matching; " +
                        "consequent type: " + 
                        this.unparse_type(t1) + ", " +
                        "alternative type: " + 
                        this.unparse_type(t2))
                }
            },
        // outside of function bodies,
        // conditional statements are 
        // treated as conditional expressions
        cond_stmt: 
            (comp, te) => {
                comp.tag = "cond_expr"
                return this.type(comp, te)
            },
        fun:
            (comp, te) => {
                const extended_te = this.extend_type_environment(
                                comp.prms,
                                comp.type.args,
                                te)
                const body_type = this.type_fun_body(comp.body, extended_te)
                if (this.equal_type(body_type, comp.type.res)) {
                    return "undefined"
                } else {
                    error("type error in function declaration; " +
                            "declared return type: " +
                            this.unparse_type(comp.type.res) + ", " +
                            "actual return type: " + 
                            this.unparse_type(body_type))
                }
            },
        app:
            (comp, te) => {
                const fun_type = this.type(comp.fun, te)
                if (fun_type.tag !== "fun") 
                    error("type error in application; function " +
                            "expression must have function type; " +
                            "actual type: " + this.unparse_type(fun_type))
                const expected_arg_types = fun_type.args
                const actual_arg_types = comp.args.map(e => this.type(e, te))
                if (this.equal_types(actual_arg_types, expected_arg_types)) {
                    return fun_type.res
                } else {
                    error("type error in application; " +
                        "expected argument types: " + 
                        this.unparse_types(expected_arg_types) + ", " +
                        "actual argument types: " + 
                        this.unparse_types(actual_arg_types))
                }
            },
        let:
            (comp, te) => {
                const declared_type = this.lookup_field("type", comp.sym, te)
                const actual_type = this.type(comp.expr, te)
                
                if (declared_type === "void" || this.equal_type(actual_type, declared_type)) { 
                    // update type to actual type, if declared type is void
                    this.update_field("type", comp.sym, actual_type, te)
                    this.update_field("mut", comp.sym, comp.mut, te)
                    
                    // handle borrowing
                    const borrow = comp.expr.ref
                    if (borrow) {
                        const borrower = comp.sym
                        const owner = comp.expr.sym
                        const borrow_type = comp.expr.mut ? "mutable" : "immutable"
                        
                        this.update_field("owner", borrower, owner, te)
                        this.update_field("borrow", borrower, borrow, te)
                        this.update_field("borrow_type", borrower, borrow_type, te)
                        
                        // set count from undefined to 0 (if needed)
                        if (this.lookup_field("mutable_borrow_count", owner, te) === undefined) {
                            this.update_field("mutable_borrow_count", owner, 0, te)
                        }
                        if (this.lookup_field("immutable_borrow_count", owner, te) === undefined) {
                            this.update_field("immutable_borrow_count", owner, 0, te)
                        }
                        
                        // handle owner
                        if (borrow_type === "mutable") {

                            // error if you try to mutable borrow, when there is already an existing mutable borrow
                            if (this.lookup_field("mutable_borrow_count", owner, te) === 1) {
                                error("cannot borrow `" + owner + "` as mutable more than once at a time")
                            }

                            // error if you try to mutable borrow, when there is an immutable borrow
                            if (this.lookup_field("immutable_borrow_count", owner, te) > 0) {
                                error("cannot borrow `" + owner + "` as mutable because it is also borrowed as immutable")
                            }
                            
                            // error if you try to mutable borrow, an immutable var
                            if (this.lookup_field("mut", owner, te) === false) {
                                error("cannot borrow `" + owner + "` as mutable, as it is not declared as mutable")
                            }

                            // error if you try to mutable borrow, as an immutable var
                            if (borrower.mut === false) {
                                error("cannot borrow `" + owner + "` as immutable because it is also borrowed as mutable")
                            }                            

                            this.update_field("mutable_borrow_count", owner, 1, te) // allow mutable borrow
                        } else {

                            // error if you try to immutable borrow, when there is an mutable borrow
                            if (this.lookup_field("mutable_borrow_count", owner, te) > 0) {
                                error("cannot borrow `" + owner + "` as immutable because it is also borrowed as mutable")
                            }

                            // increment immutable borrow count by 1
                            this.update_field("immutable_borrow_count", owner, 
                                this.lookup_field("immutable_borrow_count", owner, te) + 1, 
                                te)
                        }
                    }
                    return "undefined"
                } else {
                    error("type error in declaration; " + 
                            "expected " +
                            this.unparse_type(declared_type) + ", " +
                            "found " + 
                            this.unparse_type(actual_type))
                }
            },
        assmt:
            (comp, te) => {
                const declared_type = this.lookup_field("type", comp.sym, te)
                const actual_type = this.type(comp.expr, te)
                
                if (this.lookup_field("mut", comp.sym, te) !== true) {
                    error("cannot assign twice to immutable variable `" + comp.sym + "`")
                }

                if (this.equal_type(actual_type, declared_type)) {
                    return "undefined"
                } else {
                    error("type error in assignment; " + 
                            "expected " +
                            this.unparse_type(declared_type) + ", " +
                            "found " + 
                            this.unparse_type(actual_type))
                }
                return "undefined"
            },
        seq: 
            (comp, te) => {
                const component_types = comp.stmts.map(
                                            s => this.type(s, te))
                return component_types.length === 0
                    ? "undefined"
                    : component_types[component_types.length - 1]
            },
        blk:
            (comp, te) => {
                // scan out declarations
                let decls = [comp.body] // handle single-stmt programs
                if ("stmts" in comp.body) {
                    decls = comp.body.stmts.filter(comp => comp.tag === "let" || comp.tag === "fun")
                }
                let extended_te = this.extend_type_environment(
                                decls.map(comp => comp.sym),
                                decls.map(comp => {
                                    if (comp.tag === "fun") {
                                        /* type: {
                                            params: [  // equivalent to LHS of declaration
                                                { mut: false, ref: false, type: 'i32' },
                                                { mut: false, ref: false, type: 'bool' }
                                            ],
                                            ret: 'void'
                                        } */

                                        // handle params types declared as references (i.e. can borrow)
                                        // handle mut, which is on LHS (instead of RHS) of func signature
                                        let params = comp.prms.map(({ mut: mut, type: { tag, ...fields } }) => ({
                                                        ...fields,
                                                        mut: mut,
                                                        type: this.get_type(fields.type)
                                                    }))

                                        return { "type": {
                                            "params": params,
                                            "ret": this.get_type(comp.retType)
                                        }}
                                        
                                    }
                                    return { "type": this.get_type(comp.type) }
                                }),
                                te)
                extended_te = this.deep_copy_type_environment(extended_te)
                return this.type(comp.body, extended_te)
            },
        ret:
            (comp, te) => comp
    }

    private type = (comp, te) => {
        //console.log(comp.tag)
        return this.type_comp[comp.tag](comp, te)
    }

    // type_fun_body_stmt has the typing
    // functions for function body statements
    // for each component tag
    private type_fun_body_stmt = {
        cond_stmt: 
            (comp, te) => {
                const t0 = this.type(comp.pred, te)
                if (t0 !== "bool") 
                    error("expected predicate type: bool, " +
                        "actual predicate type: " + 
                        this.unparse_type(t0))
                const t1 = this.type_fun_body(comp.cons, te)
                const t2 = this.type_fun_body(comp.alt, te)
                if (this.equal_type(t1, t2)) {
                    return t1
                } else {
                    error("types of branches not matching; " +
                        "consequent type: " + 
                        this.unparse_type(t1) + ", " +
                        "alternative type: " + 
                        this.unparse_type(t2))
                }
            },
        seq: 
            (comp, te) => {
                for (const stmt of comp.stmts) {
                    const stmt_type = this.type_fun_body(stmt, te)
                    if (this.equal_type(stmt_type, "undefined")) {
                    } else {
                        return stmt_type
                    }
                }
                return "undefined"
            },
        blk:
            (comp, te) => {
                // scan out declarations
                let decls = [comp.body] // handle single-stmt programs
                if ("stmts" in comp.body) {
                    decls = comp.body.stmts.filter(comp => comp.tag === "let" || comp.tag === "fun")
                }

                const extended_te = this.extend_type_environment(
                                decls.map(comp => comp.sym),
                                decls.map(comp => ({ "type": this.get_type(comp.type) })),
                                te) 
                return this.type_fun_body(comp.body, extended_te)
            },
        ret:
            (comp, te) => this.type(comp.expr, te)
    }

    private type_fun_body = (comp, te) => {
        const handler = this.type_fun_body_stmt[comp.tag]
        if (handler) {
            return handler(comp, te)
        } else {
            this.type(comp, te)
            return "undefined"
        }
    }

    // type program into instruction array instrs,
    // after initializing wc and instrs
    public type_program = (program) => {
        this.type(program, this.global_type_environment)
        return true
    };
}