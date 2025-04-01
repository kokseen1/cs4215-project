import { AbstractParseTreeVisitor } from 'antlr4ng';
import { AddSubContext, BlockContext, BoolContext, ExpressionContext, ExpressionStmtContext, IdContext, IfStmtContext, IntContext, LogicalContext, MulDivContext, ParensContext, ProgContext, SimpleLangParser, StatementContext, UnaryOpContext } from './parser/src/SimpleLangParser';
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
    visitBinOp(ctx: AddSubContext | MulDivContext) {
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

    // Override the default result method from AbstractParseTreeVisitor
    protected defaultResult(): number {
        return null;
    }
}
