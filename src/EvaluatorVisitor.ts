import { AbstractParseTreeVisitor } from 'antlr4ng';
import { AddSubContext, BlockContext, BoolContext, ExpressionContext, ExpressionStmtContext, IdContext, IfStmtContext, IntContext, LogicalContext, MulDivContext, ProgContext, SimpleLangParser, StatementContext, UnaryOpContext } from './parser/src/SimpleLangParser';
import { SimpleLangVisitor } from './parser/src/SimpleLangVisitor';

function error(msg) {
    throw new Error(msg);
}

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

    visitExpressionStmt(ctx: ExpressionStmtContext): void {
        this.visit(ctx.expression());
    }

    // Literals
    visitInt(ctx: IntContext): void {
        let val = parseInt(ctx.getText())
        console.log("visit " + val);
        this.instrs[this.wc++] = { tag: "LDC", val: val }
    }

    visitBool(ctx: BoolContext): void {
        let val = ctx.getText() === "true"
            ? true
            : ctx.getText() === "false"
                ? false
                : error("Invalid boolean value: " + ctx.getText());
        console.log("visit " + val);
        this.instrs[this.wc++] = { tag: "LDC", val: val }
    }

    // Names
    visitId(ctx: IdContext): void {
        let sym = ctx.getText();
        this.instrs[this.wc++] = { tag: "LD", sym: sym }
    }

    // Operators
    visitUnaryOp(ctx: UnaryOpContext): void {
        this.visit(ctx.expression())
        this.instrs[this.wc++] = {
            tag: "UNOP", sym: ctx._op.type
        }
    }

    // Helper function
    visitBinOp(ctx: AddSubContext | MulDivContext): void {
        this.visit(ctx.expression(0));
        this.visit(ctx.expression(1));
        this.instrs[this.wc++] = {
            tag: "BINOP", sym: ctx._op.type
        }
    }

    visitIfStmt(ctx: IfStmtContext): void {
        const pred = ctx.expression();
        const cons = ctx.block(0);
        const alt = ctx.block(1);
        this.visitCond(pred, cons, alt);
    }

    // Helper function
    visitCond(pred: ExpressionContext, cons, alt): void {
        this.visit(pred);
        const jump_on_false_instruction = { tag: 'JOF', addr: undefined };
        this.instrs[this.wc++] = jump_on_false_instruction;
        this.visit(cons);
        const goto_instruction = { tag: 'GOTO', addr: undefined };
        this.instrs[this.wc++] = goto_instruction;
        const alternative_address = this.wc;
        jump_on_false_instruction.addr = alternative_address;
        this.visit(alt);
        goto_instruction.addr = this.wc;
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
