import { error, display, push, peek, is_boolean, is_null, is_number, is_string, is_undefined, arity } from './Utils';

export class TypeChecker {
    // Typed Source abuses multiplications
    // to denote lists of argument types
    // example: number * number > bool
    // is the type of a function that takes
    // two number arguments and returns a bool
    private transform_types = t => 
        t.tag === 'binop' && t.sym === '*'
        ? [...this.transform_types(t.frst),
        ...this.transform_types(t.scnd)]
        : [this.transform_type(t)]

    // the token null is used to denote an 
    // empty list of argument types
    // example: null > number
    // is the type of a nullary function
    // that returns a number
    private transform_types_or_null = t =>
        (t.tag === 'lit' && t.val === null)
        ? []
        : this.transform_types(t)

    // transform_type takes a Source expression
    // and returns the corresponding type
    // Example: 
    // transform_type(ast_to_json(parse(
    //.   "number * number > bool;")));
    // returns
    // {"tag": "fun", 
    //  "args": ["number", "number"], 
    //  "res": "bool"}
    private transform_type = t =>
        t.tag === 'nam' &&
        (t.sym === 'number' ||
        t.sym === 'bool' ||
        t.sym === 'undefined')
        ? t.sym
        : t.tag === 'binop' && t.sym === '>'
        ? {tag:'fun',
        args: this.transform_types_or_null(t.frst),
        res: this.transform_type(t.scnd)}
        : error('illegal type expression')

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

    // combine type and subsequent variable declarations
    // into type-annotated variable declarations
    private annotate_sequence = (seq) => {
        const len = seq.length
        const result = []
        let j = 0 // write pointer into result array
        // loop through array
        // use each type declaration ('assmt')
        // as a type annotation for the subsequent
        // constant declaration
        for (let i = 0; i < len; i++) {
            if (seq[i].tag === 'assmt') {
            const sym = seq[i].sym
            const t = this.transform_type(seq[i].expr)
            const next = seq[++i]
            if (next.tag === 'const' && 
                    next.sym === sym) {
                next.type = t
                next.expr = this.annotate(next.expr)
                result[j++] = next
            } else if (next.tag === 'fun' &&
                    next.sym === sym) {
                next.type = t
                next.body = this.annotate(next.body)
                result[j++] = next                
            } else {
                error(
                    'declaration of name ' + sym +
                    ' expected after its type declaration')
            }
            } else if (seq[i].tag === 'const') {
                error(
                'type declaration of name ' + seq[i].sym +
                ' before declaration missing')
            } else {
            result[j++] = this.annotate(seq[i])
            }
        }
        return result
    }

    // annotate_comp has the annotation
    // functions for each component tag
    private annotate_comp = {
    lit:
        comp => comp,
    nam:
        comp => comp,
    unop:
        comp => ({tag: 'unop',
                sym: comp.sym,
                frst: this.annotate(comp.frst)}),
    binop:
        comp => ({tag: 'binop',
                sym: comp.sym,
                frst: this.annotate(comp.frst),
                scnd: this.annotate(comp.scnd)}),
    log:
        comp => this.annotate(comp.sym == '&&' 
                    ? {tag: 'cond_expr', 
                    pred: comp.frst, 
                    cons: comp.scnd,
                    alt: {tag: 'lit', val: false}}
                    : {tag: 'cond_expr',  
                    pred: cmd.frst,
                    cons: {tag: 'lit', val: true}, 
                    alt: cmd.scnd}),
    cond_expr: 
        comp => ({tag: 'cond_expr', 
                pred: this.annotate(comp.pred), 
                cons: this.annotate(comp.cons),
                alt: this.annotate(comp.alt)}),
    cond_stmt: 
        comp => ({tag: 'cond_stmt', 
                pred: this.annotate(comp.pred), 
                cons: this.annotate(comp.cons),
                alt: this.annotate(comp.alt)}),
    app:
        comp => ({tag: 'app',
                fun: this.annotate(comp.fun),
                args: comp.args.map(this.annotate)}),
    seq: 
        comp => ({tag: 'seq',
                stmts: this.annotate_sequence(comp.stmts)}),
    blk:
        comp => ({tag: 'blk',
                body: this.annotate(comp.body)}),
    ret:
        comp => ({tag: 'ret',
                expr: this.annotate(comp.expr)}),
    fun:
        comp => this.annotate({tag:  'fun',
                        sym:  comp.sym,
                        expr: {tag: 'lam', 
                        prms: comp.prms, 
                        body: comp.body}})
    }

    // annotate declarations with
    // the preceding type declaration
    private annotate = comp =>
        this.annotate_comp[comp.tag](comp)

    // parse, turn into json (using ast_to_json), 
    // wrap in a block, and annotate
    private parse_to_json = program_text => {
        const json = this.ast_to_json(parse(program_text))
        return this.annotate(json.tag === "blk"
                        ? json
                        : json.tag === "seq"
                        ? {tag: "blk",
                        body: json}
                        : json)
    }

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
    private global_type_environment = 
        pair(global_type_frame, empty_type_environment)

    private lookup_type = (x, e) =>
        is_null(e)
        ? error("unbound name: " + x)
        : head(e).hasOwnProperty(x) 
        ? head(e)[x]
        : this.lookup_type(x, tail(e))

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
                    ? "number"
                    : is_boolean(comp.val)
                    ? "bool"
                    : is_undefined(comp.val)
                    ? "undefined"
                    : error("unknown literal: " + comp.val),
    nam:
        (comp, te) => this.lookup_type(comp.sym, te),
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
            
            // CHANGED
            if (comp.from_cond_stmt_of_func_decl || this.equal_type(t1, t2)) {
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

    // CHANGED
    cond_stmt: 
        (comp, te) => {
            if (comp.from_func_decl) {
                comp.from_cond_stmt_of_func_decl = true;
            }
            comp.tag = "cond_expr"
            return this.type(comp, te)
        },

    // LOOK HERE
    // type checking of function declarations
    // is missing. Homework consists of properly
    // checking function declarations.

    // CHANGED
    fun:
        (comp, te) => {
            
            // bind params to their types
            const extended_te = this.extend_type_environment(
                comp.prms,
                comp.type.args,
                te
            )
            
            // in func decls, all stmts (except ret stmts) should return undefined
            comp.body.from_func_decl = true;
            
            // validate that return statement has correct return type
            const ret_stmt = this.type(comp.body, extended_te)
            const actual_ret_type = this.type(ret_stmt.expr, extended_te)
            const expected_ret_type = comp.type.res
            if (actual_ret_type != expected_ret_type) {
                error("type error in function declaration; declared return type: " +
                    expected_ret_type + ", actual return type: " + actual_ret_type
                )
            }
            
            // func decls always return undefined
            return "undefined"
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
    "const":
        (comp, te) => {
            const declared_type = this.lookup_type(comp.sym, te)
            const actual_type = this.type(comp.expr, te)
            if (this.equal_type(actual_type, declared_type)) {
                return "undefined"
            } else {
                error("type error in constant declaration; " + 
                        "declared type: " +
                        this.unparse_type(declared_type) + ", " +
                        "actual type: " + 
                        this.unparse_type(actual_type))
            }
        },
        
    // CHANGED
    seq: 
        (comp, te) => {
            if (comp.from_func_decl) { 
                comp.stmts.map(s => s.from_func_decl = true) 
            }
            
            const component_types = []
            for (const s of comp.stmts) {
                const _t = type(s, te);
                component_types.push(_t)
                
                // ignore junk stmts after ret
                if (_t.tag === "ret") {
                    break
                }
            }
            
            return component_types.length === 0
                ? "undefined"
                : component_types[component_types.length - 1]
        },
    blk:
        (comp, te) => {
            // scan out declarations
            const decls = comp.body.stmts.filter(
                            comp => comp.tag === "const" ||
                                    comp.tag === "fun")
            const extended_te = this.extend_type_environment(
                            decls.map(comp => comp.sym),
                            decls.map(comp => comp.type),
                            te)
            return this.type(comp.body, extended_te)
        },
    ret:
        (comp, te) => comp
    }

    // CHANGED
    private type = (comp, te) => {
        if (comp === undefined) { 
            return "undefined";
        }
        return this.type_comp[comp.tag](comp, te)
    }

    //
    // testing
    //

    private test = (program, expected_type_or_error) => {
        let t
        try {
            t = this.unparse_type(type(parse_to_json(program),
            this.global_type_environment))
        } catch(x) {
            t = x + ""
        }
        if (t === expected_type_or_error) {
            display("pass", '\n')
        } else {
            display("Test case fails; test program:", '\n')
            display("", program + '\n')
            display("expected type: " + expected_type_or_error)
            display("computed type: " + t)
        }
    }
}