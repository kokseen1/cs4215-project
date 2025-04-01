import { SimpleLangParser } from './parser/src/SimpleLangParser';

function is_number(x) {
    return typeof x === 'number';
}

function is_string(x) {
    return typeof x === 'string';
}

function error(msg) {
    throw new Error(msg);
}

export class VirtualMachine {
    private OS: any[];
    private PC: number;
    private E;
    private RTS: any[];

    private instrs: any[];

    constructor(instrs: any[]) {
        this.instrs = instrs;
    }

    private microcode = {
        LDC:
            instr => {
                this.PC++
                this.OS.push(instr.val);
            },
        // UNOP:
        //     instr => {
        //         this.PC++
        //         this.OS.push(this.apply_unop(instr.sym, this.OS.pop()))
        //     },
        BINOP:
            instr => {
                this.PC++
                this.OS.push(this.apply_binop(instr.sym, this.OS.pop(), this.OS.pop()))
            },
    }

    private binop_microcode = {
        [SimpleLangParser.ADD]: (x, y) => (is_number(x) && is_number(y))
            ? x + y
            : (is_string(x) && is_string(y))
                ? x + y
                : error("+ expects two numbers or two strings"),
        // todo: add error handling to JS for the following, too
        [SimpleLangParser.MUL]: (x, y) => x * y,
        [SimpleLangParser.SUB]: (x, y) => x - y,
        [SimpleLangParser.DIV]: (x, y) => x / y,
        // [SimpleLangParser.ADD]: (x, y) => x % y,
        // [SimpleLangParser.ADD]: (x, y) => x < y,
        // [SimpleLangParser.ADD]: (x, y) => x <= y,
        // [SimpleLangParser.ADD]: (x, y) => x >= y,
        // [SimpleLangParser.ADD]: (x, y) => x > y,
        // [SimpleLangParser.ADD]: (x, y) => x === y,
        // [SimpleLangParser.ADD]: (x, y) => x !== y
    }

    private apply_binop(op, v1, v2) {
        return this.binop_microcode[op](v1, v2);
    }

    public run() {
        this.OS = [];
        this.PC = 0;
        this.E = {};
        this.RTS = [];

        //print_code(instrs)
        while (!(this.instrs[this.PC].tag === 'DONE')) {
            //display("next instruction: ")
            //print_code([instrs[PC]]) 
            //display(PC, "PC: ")
            //print_OS("\noperands:            ");
            //print_RTS("\nRTS:            ");
            const instr = this.instrs[this.PC]
            this.microcode[instr.tag](instr)
        }
        return this.OS.pop();
    }
}

