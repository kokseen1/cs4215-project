import { AbstractParseTreeVisitor } from 'antlr4ng';
import { AddSubContext, AssignContext, BlockContext, BoolContext, CompareContext, ExpressionContext, ExpressionStmtContext, FuncDefContext, IdContext, IfStmtContext, IntContext, LetDeclContext, LogicalContext, MulDivContext, ParamContext, ParamListContext, ParensContext, ProgContext, ReturnStmtContext, SimpleLangParser, StatementContext, TypeContext, UnaryOpContext, WhileStmtContext } from './parser/src/SimpleLangParser';
import { SimpleLangVisitor } from './parser/src/SimpleLangVisitor';

function error(msg) {
    throw new Error(msg);
}

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
        console.log("visit int " + val)
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
        console.log(pred)
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
        console.log("block")
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
        const id = ctx.ID().getText();
        const params = ctx.paramList();
        const retType = ctx.type();
        const block = ctx.block();

        return {
            tag: "fun",
            sym: id,
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

    visitParam(ctx: ParamContext) {
        const type = ctx.type();
        const id = ctx.ID().getText();
        return {
            tag: "param",
            id: id,
            type: this.visit(type),
        }
    }

    visitType(ctx: TypeContext) {
        // TODO: support recursive types
        if (ctx === null) return { tag: "type", sym: "void" } // void return type
        return {
            tag: "type",
            sym: ctx.getText()
        }
    }

    // Override the default result method from AbstractParseTreeVisitor
    protected defaultResult(): number {
        return null;
    }
}
