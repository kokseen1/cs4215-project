import { error } from './Utils';
import { AbstractParseTreeVisitor } from 'antlr4ng';
import { AddSubContext, ArgListContext, AssignContext, BlockContext, BoolContext, CompareContext, ExpressionContext, ExpressionStmtContext, FuncDefContext, FunctionCallContext, IdContext, IfStmtContext, IntContext, LetDeclContext, LogicalContext, MulDivContext, MutableReferenceContext, ParamContext, ParamListContext, ParensContext, ProgContext, ReferenceContext, ReturnStmtContext, SimpleLangParser, StatementContext, TypeContext, UnaryOpContext, WhileStmtContext } from './parser/src/SimpleLangParser';
import { SimpleLangVisitor } from './parser/src/SimpleLangVisitor';

export class SimpleLangEvaluatorVisitor extends AbstractParseTreeVisitor<any> implements SimpleLangVisitor<any> {

    visitProg(ctx: ProgContext) {
        const stmts = ctx.statement();
        return {
            tag: "blk",
            body: this.visitSeq(stmts)
        };
    }

    visitSeq(stmts: StatementContext[]) {
        return stmts.length === 1
            ? this.visit(stmts.at(0))
            : {
                tag: "seq",
                stmts: stmts.length === 0
                    ? []
                    : stmts.map(stmt => this.visit(stmt))
            }
    }

    visitExpressionStmt(ctx: ExpressionStmtContext) {
        return this.visit(ctx.expression());
    }

    // Literals
    visitInt(ctx: IntContext) {
        const val = parseInt(ctx.getText())
        return { tag: "lit", val: val }
    }

    visitBool(ctx: BoolContext) {
        const val = ctx.getText() === "true"
            ? true
            : ctx.getText() === "false"
                ? false
                : error("Invalid boolean value: " + ctx.getText());
        return { tag: "lit", val: val }
    }

    // Names
    visitId(ctx: IdContext) {
        const sym = ctx.getText();
        return { tag: "nam", sym: sym }
    }

    // Operators
    visitUnaryOp(ctx: UnaryOpContext) {
        const frst = ctx.expression();
        return { tag: "unop", sym: ctx._op.type, frst: frst };
    }

    // Helper function
    visitBinOp(ctx: AddSubContext | MulDivContext | CompareContext) {
        const frst = ctx.expression(0);
        const scnd = ctx.expression(1);
        return {
            tag: "binop",
            sym: ctx._op.type,
            frst: this.visit(frst),
            scnd: this.visit(scnd)
        };
    }

    visitAddSub(ctx: AddSubContext) {
        return this.visitBinOp(ctx);
    }

    visitMulDiv(ctx: MulDivContext) {
        return this.visitBinOp(ctx);
    }

    visitCompare(ctx: CompareContext) {
        return this.visitBinOp(ctx);
    }

    visitIfStmt(ctx: IfStmtContext) {
        const pred = ctx.expression();
        const cons = ctx.block(0);
        const alt = ctx.block(1);

        return {
            tag: "cond",
            pred: this.visit(pred),
            cons: this.visit(cons),
            alt: alt ? this.visit(alt) : { tag: "seq", stmts: [] }
        }
    }

    visitLogical(ctx: LogicalContext) {
        const frst = ctx.expression(0);
        const scnd = ctx.expression(1);
        const sym = ctx._op.type;

        return {
            tag: "log",
            frst: this.visit(frst),
            scnd: this.visit(scnd),
            sym: sym
        }
    }

    visitWhileStmt(ctx: WhileStmtContext) {
        const pred = ctx.expression();
        const body = ctx.block();
        return {
            tag: "while",
            pred: this.visit(pred),
            body: this.visit(body)
        };
    }

    visitMutableReference(ctx: MutableReferenceContext) {
        const expr = ctx.expression();
        const nam = this.visit(expr); // assume expression can only be Id
        nam.ref = true;
        nam.mut = true;
        return nam
    }

    visitReference(ctx: ReferenceContext) {
        const expr = ctx.expression();
        const nam = this.visit(expr); // assume expression can only be Id
        nam.ref = true;
        return nam
    }

    visitReturnStmt(ctx: ReturnStmtContext) {
        const expr = ctx.expression();
        return {
            tag: "ret",
            expr: this.visit(expr)
        };
    }

    visitParens(ctx: ParensContext) {
        return this.visit(ctx.expression());
    }

    visitBlock(ctx: BlockContext) {
        // TODO: check if blk is needed here
        // blk required only if there are declarations (env needs to be extended)?
        const stmts = ctx.statement();
        return {
            tag: "blk",
            body: this.visitSeq(stmts)
        };
    }

    visitLetDecl(ctx: LetDeclContext) {
        const type = ctx.type(); // optional, null if unspecified
        const mut = ctx.MUT(); // optional, null if unspecified
        const expr = ctx.expression();
        const id = ctx.ID().getText();
        return {
            tag: "let",
            sym: id,
            mut: mut !== null,
            type: this.visitType(type), // will be type: void if unspecified
            expr: this.visit(expr)
        }
    }

    visitAssign(ctx: AssignContext) {
        const expr = ctx.expression();
        const id = ctx.ID().getText();
        return {
            tag: "assmt",
            sym: id,
            expr: this.visit(expr)
        }
    }

    visitFuncDef(ctx: FuncDefContext) {
        const id = ctx.ID();
        const params = ctx.paramList();
        const retType = ctx.type();
        const block = ctx.block();

        return {
            tag: "fun",
            sym: id.getText(),
            prms: this.visitParamList(params),
            body: this.visit(block),
            retType: this.visitType(retType),
        }
    }

    visitParamList(ctx: ParamListContext) {
        if (ctx === null) return []; // no parameters
        const params = ctx.param();
        return params.length === 0
            ? error("error: empty params list") // should not happen here
            : params.map(p => this.visit(p));
    }

    visitArgList(ctx: ArgListContext) {
        if (ctx === null) return []; // no args
        const args = ctx.expression();
        return args.length === 0
            ? error("error: empty args list") // should not happen here
            : args.map(a => {
                const arg = this.visit(a);
                arg.is_arg = true;
                return arg;
            });
    }

    visitParam(ctx: ParamContext) {
        const type = ctx.type();
        const mut = ctx.MUT();
        const id = ctx.ID().getText();
        return {
            tag: "param",
            sym: id, // sym to ensure consistency in compile-time-env
            mut: mut !== null,
            type: this.visit(type),
        }
    }

    visitType(ctx: TypeContext) {
        if (ctx === null) return { tag: "type", type: "void" } // void return type
        const mut = ctx.MUT();
        const ref = ctx.REF();
        const type = ctx.type();

        return {
            tag: "type",
            mut: mut !== null,
            ref: ref !== null,
            // Recursively check until reaching a primitive
            type: (type !== null)
                ? this.visit(type) // nested type
                : ctx.getText() // primitive type
        }
    }

    visitFunctionCall(ctx: FunctionCallContext) {
        const id = ctx.ID();
        const argList = ctx.argList();

        return {
            tag: "app",
            fun: { tag: "nam", sym: id.getText() },
            args: this.visitArgList(argList)
        }
    }

    // Override the default result method from AbstractParseTreeVisitor
    protected defaultResult(): number {
        return null;
    }
}
