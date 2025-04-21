import { error, is_number, is_boolean, is_string, is_undefined, pair, head, tail, is_null, pprint } from './Utils';

export class TypeChecker {
    constructor() {}

    private equal_type = (t1, t2) => t1 === t2
    private equal_types = (param_types, arg_types) => {
        if (param_types.length !== arg_types.length) {
            return false;
        }
        for (let i = 0; i < arg_types.length; i++) {
            if (!(this.equal_type(param_types[i], arg_types[i]))) {
                let relaxed_arg_type = arg_types[i].replace("mut ", "")
                if (!(this.equal_type(param_types[i], relaxed_arg_type))) {
                    return false;
                }
            }
        }
        return true;
    }

    /* *****************
    * type environments
    * *****************/

    // Type frames are JavaScript objects that map 
    // symbols (strings) to types.
    private unary_arith_type =
        { tag: "fun", params: ["i32"], 
        ret: "i32", built_in: true }
        
    private binary_arith_type =
        { tag: "fun", params: ["i32", "i32"], 
        ret: "i32", built_in: true }

    private number_comparison_type =
        { tag: "fun", params: ["i32", "i32"], 
        ret: "bool", built_in: true }

    private binary_bool_type =
        { tag: "fun", params: ["bool"], 
        ret: "bool", built_in: true }
        
    private unary_bool_type =
        { tag: "fun", params: ["bool"], 
        ret: "bool", built_in: true }
        
    private global_type_frame = {
        "undefined": { "type": "undefined" },
        math_E: { "type": "number" },
        math_PI: { "type": "number" },
        math_sin: { "type": this.unary_arith_type },
        "+": { "type": this.binary_arith_type },
        "-": { "type": this.binary_arith_type },
        "*": { "type": this.binary_arith_type },
        "/": { "type": this.binary_arith_type },
        "<": { "type": this.number_comparison_type },
        ">": { "type": this.number_comparison_type },
        "<=": { "type": this.number_comparison_type },
        ">=": { "type": this.number_comparison_type },
        "==": { "type": this.number_comparison_type },
        "&&": { "type": this.binary_bool_type },
        "||": { "type": this.binary_bool_type },
        "-unary": { "type": this.unary_arith_type },
        "!": { "type": this.unary_bool_type },
    }

    // A type environment is null or a pair 
    // whose head is a frame and whose tail 
    // is a type environment.
    private empty_type_environment = null
    private global_type_environment = pair(this.global_type_frame, this.empty_type_environment)
    private reference_counting_environment = pair({}, null) // denoted as rc

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
        : this.update_field(field, x, val, tail(e))
    }

    private lookup_function_field = (field, func_name, param_name, e) => {
        return is_null(e)
        ? error("unbound name: " + func_name)
        : head(e).hasOwnProperty(func_name)
        ? (
            head(e)[func_name]["type"]["params"].forEach(p => {
                if (p.sym === param_name) {
                    return p[field]
                }
            })
        )
        : this.lookup_function_field(field, func_name, param_name, tail(e))
    }

    private update_function_field = (field, func_name, param_name, val, e) => {
        return is_null(e)
        ? error("unbound name: " + func_name)
        : head(e).hasOwnProperty(func_name)
        ? (
            head(e)[func_name]["type"]["params"].forEach(p => {
                if (p.sym === param_name) {
                    p[field] = val;
                }
            })
        )
        : this.update_function_field(field, func_name, param_name, val, tail(e))
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

    private check_borrowing = (borrower, borrow_type, owner, te, rc) => {
        // set count from undefined to 0 (if needed)
        if (this.lookup_field("mutable_borrow_count", owner, rc) === undefined) {
            this.update_field("mutable_borrow_count", owner, 0, rc)
        }
        if (this.lookup_field("immutable_borrow_count", owner, rc) === undefined) {
            this.update_field("immutable_borrow_count", owner, 0, rc)
        }
        
        // handle owner
        if (borrow_type === "mutable") {

            // error if you try to mutable borrow, when there is already an existing mutable borrow
            if (this.lookup_field("mutable_borrow_count", owner, rc) === 1) {
                error("cannot borrow `" + owner + "` as mutable more than once at a time")
            }

            // error if you try to mutable borrow, when there is an immutable borrow
            if (this.lookup_field("immutable_borrow_count", owner, rc) > 0) {
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

            this.update_field("mutable_borrow_count", owner, 1, rc) // allow mutable borrow
        } else {

            // error if you try to immutable borrow, when there is an mutable borrow
            if (this.lookup_field("mutable_borrow_count", owner, rc) > 0) {
                error("cannot borrow `" + owner + "` as immutable because it is also borrowed as mutable")
            }

            // increment immutable borrow count by 1
            this.update_field("immutable_borrow_count", owner, 
                this.lookup_field("immutable_borrow_count", owner, rc) + 1, 
                rc)
        }
    }

    // type_comp has the typing
    // functions for each component tag
    private type_comp = {
        lit:
            (comp, te, rc) => is_number(comp.val)
                        ? "i32"
                        : is_boolean(comp.val)
                        ? "bool"
                        : is_string(comp.val)
                        ? "String"
                        : error("unknown literal: " + comp.val),
        nam:
            (comp, te, rc) => {
                let sym = comp.deref ? this.lookup_field("owner", comp.sym, te) : comp.sym // get owner if deref
                return this.lookup_field("type", sym, te)
            },
        unop:
            (comp, te, rc) => this.type({tag: 'app',
                                fun: {tag: 'nam', sym: comp.sym},
                                args: [comp.frst]}, te, rc),
        binop:
            (comp, te, rc) => this.type({tag: 'app',
                                fun: {tag: 'nam', sym: comp.sym},
                                args: [comp.frst, comp.scnd]}, te, rc),
        log:
            (comp, te, rc) => this.type({tag: 'app',
                                fun: {tag: 'nam', sym: comp.sym},
                                args: [comp.frst, comp.scnd]}, te, rc),
        cond: 
            (comp, te, rc) => {
                const t0 = this.type(comp.pred, te, rc)
                if (t0 !== "bool") 
                    error("expected predicate type: bool, " +
                        "actual predicate type: " + t0)
                const t1 = this.type(comp.cons, te, rc)
                const t2 = this.type(comp.alt, te, rc)
                if (this.equal_type(t1, t2)) {
                    return t1
                } else {
                    error("types of branches not matching; " +
                        "consequent type: " +  t1 + ", " +
                        "alternative type: " + t2)
                }
            },
        while:
            (comp, te, rc) => {
                // check type of predicate evals to bool
                const t0 = this.type(comp.pred, te, rc)
                if (t0 !== "bool") 
                    error("expected predicate type: bool, " +
                        "actual predicate type: " + t0)

                // pass body to blk
                return this.type(comp.body, te, rc)
            },
        fun:
            (comp, te, rc) => {
                const func_type = this.lookup_field("type", comp.sym, te)
                const extended_te = this.extend_type_environment(
                                comp.prms.map(p => p.sym),
                                func_type.params,
                                te)
                const extended_rc = this.deep_copy_type_environment(this.extend_type_environment(
                    comp.prms.map(comp => comp.sym), 
                    func_type.params,
                    rc
                ))
                const body_type = this.type_fun_body(comp.body, extended_te, extended_rc)
                if (this.equal_type(body_type, func_type.ret)) {
                    return "void"
                } else {
                    error("type error in function declaration; " +
                            "declared return type: " + func_type.ret + ", " +
                            "actual return type: " + body_type)
                }
            },
        app:
            (comp, te, rc) => {
                const func_name = comp.fun.sym
                const func_type = this.type(comp.fun, te, rc)
                const params = func_type.params
                
                if (func_type.built_in) {
                    const param_types = params
                    const arg_types = comp.args.map(e => this.type(e, te, rc))
                    if (!this.equal_types(param_types, arg_types)) {
                        error("type error in application:\n" +
                            "expected parameter types: [ " + param_types + " ]\n" +
                            "actual argument types: [ " + arg_types + " ]")
                    }
                } else { // user-defined functions

                    // implement borrow checking for symbols that are passed to functions
                    rc = this.deep_copy_type_environment(rc)
                    comp.args.map((arg, i) => {
                        const borrow = arg.ref
                        if ("sym" in arg && borrow) {
                            const owner = arg.sym
                            const borrower = params[i].sym 
                            const borrow_type = arg.mut ? "mutable" : "immutable"

                            this.update_function_field("owner", func_name, borrower, owner, te)
                            this.check_borrowing(borrower, borrow_type, owner, te, rc)
                        }
                    })

                    // check param types against arg types
                    const param_types = func_type.params.map(p => p.type)
                    const params_borrow_type = func_type.params.map(p => p.borrow).map(p => p ? "& " : "")
                    const params_mut_type = func_type.params.map(p => p.borrow_type).map(p => p === "mutable" ? "mut " : "")
                    const merged_param_types = param_types.map((item, i) => params_borrow_type[i] + params_mut_type[i] + item);

                    const arg_types = comp.args.map(e => this.type(e, te, rc))
                    const args_borrow_type = comp.args.map(arg => "sym" in arg ? arg.ref : false).map(p => p ? "& " : "")
                    const args_mut_type = comp.args.map(p => p.mut).map(p => p ? "mut " : "")
                    const merged_arg_types = arg_types.map((item, i) => args_borrow_type[i] + args_mut_type[i] + item);

                    if (!this.equal_types(merged_param_types, merged_arg_types)) {
                        error("type error in application:\n" +
                            "expected parameter types: [ " + merged_param_types + " ]\n" +
                            "actual argument types: [ " + merged_arg_types + " ]")
                    }
                }
                return func_type.ret

            },
        let:
            (comp, te, rc) => {
                const declared_type = this.lookup_field("type", comp.sym, te)
                const actual_type = this.type(comp.expr, te, rc)
                
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
                        
                        this.check_borrowing(borrower, borrow_type, owner, te, rc)
                    }
                    return "void"
                } else {
                    error("type error in declaration; " + 
                            "expected " + declared_type + ", " +
                            "found " + actual_type)
                }
            },
        assmt:
            (comp, te, rc) => {
                let sym = comp.deref ? this.lookup_field("owner", comp.sym, te) : comp.sym // get owner if deref
                const declared_type = this.lookup_field("type", sym, te)
                const actual_type = this.type(comp.expr, te, rc)

                if (this.lookup_field("mut", sym, te) !== true) {
                    if (this.lookup_field("param", sym, te) === true) {
                        error("cannot assign to immutable argument `" + sym + "`")
                    }
                    else if (comp.deref === true) {
                        error("cannot assign to `*" + comp.sym + "`, which is behind a `&` reference")
                    }
                    error("cannot assign twice to immutable variable `" + sym + "`")
                }

                if (this.equal_type(actual_type, declared_type)) {
                    // handle borrowing
                    const borrow = comp.expr.ref
                    if (borrow) {
                        const borrower = sym
                        const owner = comp.expr.sym
                        const borrow_type = comp.expr.mut ? "mutable" : "immutable"
                        
                        this.update_field("owner", borrower, owner, te)
                        this.update_field("borrow", borrower, borrow, te)
                        this.update_field("borrow_type", borrower, borrow_type, te)
                        
                        this.check_borrowing(borrower, borrow_type, owner, te, rc)
                    }
                    return "void"
                } else {
                    error("type error in assignment; " + 
                            "expected " + declared_type + ", " +
                            "found " + actual_type)
                }
                return "void"
            },
        seq: 
            (comp, te, rc) => {
                const component_types = comp.stmts.map(
                                            s => this.type(s, te, rc))
                return component_types.length === 0
                    ? "void"
                    : component_types[component_types.length - 1]
            },
        blk:
            (comp, te, rc) => {
                // scan out declarations (handle single-stmt programs too)
                let decls = ("stmts" in comp.body ? comp.body.stmts : [comp.body])
                                .filter(comp => comp.tag === "let" || comp.tag === "fun")

                const vals = decls.map(comp => {
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
                            ({ mut: outer_mut, sym: sym, type: { tag, ref, mut, ...fields } }) => {
                                return {
                                    ...fields,
                                    sym: sym,
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
                })

                const extended_te = this.extend_type_environment(decls.map(comp => comp.sym), vals, te)
                const extended_rc = this.deep_copy_type_environment(
                    this.extend_type_environment(decls.map(comp => comp.sym), vals, rc
                ))
                return this.type(comp.body, extended_te, extended_rc)
            },
        ret:
            (comp, te, rc) => this.type(comp.expr, te, rc)
    }

    private type = (comp, te, rc) => {
        if (!(comp.tag in this.type_comp)) {
            console.log(comp.tag)
        }
        return this.type_comp[comp.tag](comp, te, rc)
    }

    // type_fun_body_stmt has the typing
    // functions for function body statements
    // for each component tag
    private type_fun_body_stmt = {
        cond_stmt: 
            (comp, te, rc) => {
                const t0 = this.type(comp.pred, te, rc)
                if (t0 !== "bool") 
                    error("expected predicate type: bool, " +
                        "actual predicate type: " + 
                        t0)
                const t1 = this.type_fun_body(comp.cons, te, rc)
                const t2 = this.type_fun_body(comp.alt, te, rc)
                if (this.equal_type(t1, t2)) {
                    return t1
                } else {
                    error("types of branches not matching; " +
                        "consequent type: " + t1 + ", " +
                        "alternative type: " + t2)
                }
            },
        seq: 
            (comp, te, rc) => {
                for (const stmt of comp.stmts) {
                    const stmt_type = this.type_fun_body(stmt, te, rc)
                    if (this.equal_type(stmt_type, "void")) {
                    } else {
                        return stmt_type
                    }
                }
                return "void"
            },
        blk:
            (comp, te, rc) => {
                // scan out declarations (handle single-stmt programs too)
                let decls = ("stmts" in comp.body ? comp.body.stmts : [comp.body])
                                .filter(comp => comp.tag === "let" || comp.tag === "fun")
                
                const vals = decls.map(comp => {
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
                })

                const extended_te = this.extend_type_environment(decls.map(comp => comp.sym), vals, te)
                
                const extended_rc = this.deep_copy_type_environment(
                    this.extend_type_environment(decls.map(comp => comp.sym), vals, rc
                ))
                return this.type(comp.body, extended_te, extended_rc)
            },
        ret:
            (comp, te, rc) => this.type(comp.expr, te, rc)
    }

    private type_fun_body = (comp, te, rc) => {
        const handler = this.type_fun_body_stmt[comp.tag]
        if (handler) {
            return handler(comp, te, rc)
        } else {
            this.type(comp, te, rc)
            return "void"
        }
    }

    // type program into instruction array instrs,
    // after initializing wc and instrs
    public type_program = (program) => {
        this.type(program, this.global_type_environment, this.reference_counting_environment)
        //console.log("[[[SUCCESS]]]")
        return [true, program]
    };
}