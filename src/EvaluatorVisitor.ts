import { AbstractParseTreeVisitor } from 'antlr4ng';
import { AddSubContext, ExpressionContext, ExpressionStmtContext, IdContext, IntContext, MulDivContext, ProgContext, SimpleLangParser, StatementContext } from './parser/src/SimpleLangParser';
import { SimpleLangVisitor } from './parser/src/SimpleLangVisitor';

export class SimpleLangEvaluatorVisitor extends AbstractParseTreeVisitor<void> implements SimpleLangVisitor<void> {

    public instrs = [];
    public wc = 0;

    visitProg(ctx: ProgContext): any[] {
        let last;
        for (let s of ctx.statement()) {
            last = this.visit(s);
        }
        this.instrs[this.wc] = { tag: 'DONE' }
        return this.instrs;
    }

    visitInt(ctx: IntContext): void {
        let val = parseInt(ctx.getText())
        this.instrs[this.wc++] = { tag: "LDC", val: val }
    }

    visitId(ctx: IdContext): void {
        let sym = ctx.getText();
        this.instrs[this.wc++] = { tag: "LD", sym: sym }
    }

    visitExpressionStmt(ctx: ExpressionStmtContext): void {
        this.visit(ctx.expression());
    }

    visitBinOp(ctx: AddSubContext | MulDivContext): void {
        this.visit(ctx.expression(0));
        this.visit(ctx.expression(1));
        this.instrs[this.wc++] = {
            tag: "BINOP", sym: ctx._op.type
        }
    }

    visitAddSub(ctx: AddSubContext): void {
        this.visitBinOp(ctx);
    }

    visitMulDiv(ctx: MulDivContext): void {
        this.visitBinOp(ctx);
    }

    // Override the default result method from AbstractParseTreeVisitor
    protected defaultResult(): number {
        return 0;
    }
}
