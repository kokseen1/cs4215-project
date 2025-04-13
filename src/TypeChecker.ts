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
                        : is_string(comp.val)
                        ? "String"
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
                const func_type = this.lookup_field("type", comp.sym, te)
                let extended_te = this.extend_type_environment(
                                comp.prms.map(p => p.sym),
                                func_type.params,
                                te)
                extended_te = this.deep_copy_type_environment(extended_te)
                const body_type = this.type_fun_body(comp.body, extended_te)
                if (this.equal_type(body_type, func_type.ret)) {
                    return "void"
                } else {
                    error("type error in function declaration; " +
                            "declared return type: " + this.unparse_types(func_type.ret) + ", " +
                            "actual return type: " + this.unparse_types(body_type))
                }
            },
        app:
            (comp, te) => {
                
                // ADD BORROW CHECKING HERE !!

                const func_type = this.type(comp.fun, te)
                const param_types = func_type.params.map(p => p.type)
                const params_borrow_type = func_type.params.map(p => p.borrow).map(p => p ? "& " : "")
                const params_mut_type = func_type.params.map(p => p.borrow_type).map(p => p === "mutable" ? "mut " : "")
                const merged_param_types = param_types.map((item, i) => params_borrow_type[i] + params_mut_type[i] + item);
                
                const arg_types = comp.args.map(e => this.type(e, te))
                const args_borrow_type = comp.args.map(arg => "sym" in arg ? arg.ref : false).map(p => p ? "& " : "")
                const args_mut_type = comp.args.map(p => p.mut).map(p => p ? "mut " : "")
                const merged_arg_types = arg_types.map((item, i) => args_borrow_type[i] + args_mut_type[i] + item);
                
                // check type
                if (!this.equal_types(merged_param_types, merged_arg_types)) {
                    error("type error in application:\n" +
                        "expected parameter types: [ " + this.unparse_types(merged_param_types) + " ]\n" +
                        "actual argument types: [ " + this.unparse_types(merged_arg_types) + " ]")
                }
                return func_type.ret

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
                    return "void"
                } else {
                    error("type error in declaration; " + 
                            "expected " + this.unparse_types(declared_type) + ", " +
                            "found " + this.unparse_types(actual_type))
                }
            },
        assmt:
            (comp, te) => {
                const declared_type = this.lookup_field("type", comp.sym, te)
                const actual_type = this.type(comp.expr, te)
                if (this.lookup_field("mut", comp.sym, te) !== true) {
                    if (this.lookup_field("param", comp.sym, te) === true) {
                        error("cannot assign to immutable argument `" + comp.sym + "`")
                    }
                    error("cannot assign twice to immutable variable `" + comp.sym + "`")
                }

                if (this.equal_type(actual_type, declared_type)) {
                    return "void"
                } else {
                    error("type error in assignment; " + 
                            "expected " + declared_type + ", " +
                            "found " + actual_type)
                }
                return "void"
            },
        seq: 
            (comp, te) => {
                const component_types = comp.stmts.map(
                                            s => this.type(s, te))
                return component_types.length === 0
                    ? "void"
                    : component_types[component_types.length - 1]
            },
        blk:
            (comp, te) => {
                // scan out declarations (handle single-stmt programs too)
                let decls = ("stmts" in comp.body ? comp.body.stmts : [comp.body])
                                .filter(comp => comp.tag === "let" || comp.tag === "fun")

                let extended_te = this.extend_type_environment(
                                decls.map(comp => comp.sym),
                                decls.map(comp => {
                                    if (comp.tag === "fun") {
                                        /* map fn `f` to its param types `i32` & `bool` and ret type `void`
                                        type: {
                                            params: [  // equivalent to LHS of declaration
                                                { mut: false, ref: false, type: 'i32' },
                                                { mut: false, ref: false, type: 'bool' }
                                            ],
                                            ret: 'void'
                                        } */

                                        // handle params types declared as references (i.e. can borrow)
                                        // handle mut, which is on LHS (instead of RHS) of func signature
                                        let params = comp.prms.map(
                                            ({ mut: outer_mut, type: { tag, ref, mut, ...fields } }) => {
                                                return {
                                                    ...fields,
                                                    mut: outer_mut,
                                                    borrow: ref,
                                                    borrow_type: mut ? "mutable" : "immutable",
                                                    type: this.get_type(fields.type),
                                                    param: true
                                                }
                                            }
                                        )

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
            (comp, te) => this.type(comp.expr, te)
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
                    if (this.equal_type(stmt_type, "void")) {
                    } else {
                        return stmt_type
                    }
                }
                return "void"
            },
        blk:
            (comp, te) => {
                // scan out declarations (handle single-stmt programs too)
                let decls = ("stmts" in comp.body ? comp.body.stmts : [comp.body])
                                .filter(comp => comp.tag === "let" || comp.tag === "fun")
                
                let extended_te = this.extend_type_environment(
                                decls.map(comp => comp.sym),
                                decls.map(comp => {
                                    if (comp.tag === "fun") {
                                        // handle params types declared as references (i.e. can borrow)
                                        // handle mut, which is on LHS (instead of RHS) of func signature
                                        let params = comp.prms.map(({ mut: mut, type: { tag, ref, ...fields } }) => ({
                                                        ...fields,
                                                        mut: mut,
                                                        borrow: ref,
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
            (comp, te) => this.type(comp.expr, te)
    }

    private type_fun_body = (comp, te) => {
        const handler = this.type_fun_body_stmt[comp.tag]
        if (handler) {
            return handler(comp, te)
        } else {
            this.type(comp, te)
            return "void"
        }
    }

    // type program into instruction array instrs,
    // after initializing wc and instrs
    public type_program = (program) => {
        this.type(program, this.global_type_environment)
        console.log("[[[SUCCESS]]]")
        return true
    };
}