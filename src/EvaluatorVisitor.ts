import { AbstractParseTreeVisitor } from 'antlr4ng';
import { AddSubContext, ExpressionContext, ExpressionStmtContext, IdContext, IntContext, LetStmtContext, ProgContext, SimpleLangParser, StatementContext } from './parser/src/SimpleLangParser';
import { SimpleLangVisitor } from './parser/src/SimpleLangVisitor';

export class SimpleLangEvaluatorVisitor extends AbstractParseTreeVisitor<number> implements SimpleLangVisitor<number> {
    // Visit a parse tree produced by SimpleLangParser#prog
    visitProg(ctx: ProgContext): number {
        let last;
        for (let s of ctx.statement()) {
            last = this.visit(s);
        }
        return last;
    }

    dict = {}

    visitExpressionStmt(ctx: ExpressionStmtContext): number {
        return this.visit(ctx.expression());
    }

    visitLetStmt(ctx: LetStmtContext): number {
        let id: string = ctx.ID().getText();  // id is left-hand side of '='
        let value: number = this.visit(ctx.expression());   // compute value of expression on right
        console.log("storing " + value + " as " + id);
        this.dict[id] = value;
        return value;
    }

    visitInt(ctx: IntContext): number {
        console.log("visit int");
        return parseInt(ctx.getText());
    }

    visitId(ctx: IdContext): number {
        console.log("visit id")
        let id = ctx.getText();
        return this.dict[id];
    }

    visitAddSub(ctx: AddSubContext): number {
        let left = this.visit(ctx.expression(0));  // get value of left subexpression
        console.log("left " + left);
        let right = this.visit(ctx.expression(1)); // get value of right subexpression
        console.log("right " + right);
        if (ctx._op.type == SimpleLangParser.ADD) { return left + right; }
        else if (ctx._op.type == SimpleLangParser.SUB) { return left - right; }
    }

    // Override the default result method from AbstractParseTreeVisitor
    protected defaultResult(): number {
        return 0;
    }

    // Override the aggregate result method
    protected aggregateResult(aggregate: number, nextResult: number): number {
        return nextResult;
    }
}
