import { SimpleLangParser } from './parser/src/SimpleLangParser';

export class VirtualMachine {
    private OS: any[];
    private PC: number;
    private E;
    private RTS: any[];

    constructor() {
    }

    private microcode = {
        LDC:
            instr => {
                this.PC++
                this.OS.push(instr.val);
            },
        UNOP:
            instr => {
                this.PC++
                this.OS.push(this.apply_unop(instr.sym, this.OS.pop()))
            },
        JOF:
            instr => {
                this.PC = this.OS.pop() ? this.PC + 1 : instr.addr
            },
        GOTO:
            instr => {
                this.PC = instr.addr
            },
        BINOP:
            instr => {
                this.PC++
                this.OS.push(this.apply_binop(instr.sym, this.OS.pop(), this.OS.pop()))
            },
        POP:
            instr => {
                this.PC++
                this.OS.pop()
            },
        ENTER_SCOPE:
            instr => {
                this.PC++
                this.RTS.push({ tag: 'BLOCK_FRAME', env: this.E })
                const locals = instr.syms
                // const unassigneds = locals.map(_ => unassigned)
                // this.E = extend(locals, unassigneds, this.E)
            },
        EXIT_SCOPE:
            instr => {
                this.PC++
                this.E = this.RTS.pop().env
            },
        // LD:
        //     instr => {
        //         this.PC++
        //         this.OS.push( this.lookup(instr.sym, this.E))
        //     },
        // ASSIGN:
        //     instr => {
        //         this.PC++
        //         assign_value(instr.sym, peek(OS), E)
        //     },
        LDF:
            instr => {
                this.PC++
                this.OS.push({
                    tag: 'CLOSURE', prms: instr.prms,
                    addr: instr.addr, env: this.E
                })
            },
        // CALL:
        //     instr => {
        //         const arity = instr.arity
        //         let args = []
        //         for (let i = arity - 1; i >= 0; i--)
        //             args[i] = OS.pop()
        //         const sf = OS.pop()
        //         if (sf.tag === 'BUILTIN') {
        //             PC++
        //             return push(OS, apply_builtin(sf.sym, args))
        //         }
        //         push(RTS, { tag: 'CALL_FRAME', addr: PC + 1, env: E })
        //         E = extend(sf.prms, args, sf.env)
        //         PC = sf.addr
        //     },
        // TAIL_CALL:
        //     instr => {
        //         const arity = instr.arity
        //         let args = []
        //         for (let i = arity - 1; i >= 0; i--)
        //             args[i] = OS.pop()
        //         const sf = OS.pop()
        //         if (sf.tag === 'BUILTIN') {
        //             PC++
        //             return push(OS, apply_builtin(sf.sym, args))
        //         }
        //         // dont push on RTS here
        //         E = extend(sf.prms, args, sf.env)
        //         PC = sf.addr
        //     },
        // RESET:
        //     instr => {
        //         // keep popping...
        //         const top_frame = RTS.pop()
        //         if (top_frame.tag === 'CALL_FRAME') {
        //             // ...until top frame is a call frame
        //             PC = top_frame.addr
        //             E = top_frame.env
        //         }
        //     }
    }

    private unop_microcode = {
        [SimpleLangParser.SUB]: x => - x,
        [SimpleLangParser.NOT]: x => is_boolean(x)
            ? !x
            : error('! expects boolean, found: ' + x)
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
        [SimpleLangParser.LT]: (x, y) => x < y,
        [SimpleLangParser.GT]: (x, y) => x > y,
        [SimpleLangParser.LE]: (x, y) => x <= y,
        [SimpleLangParser.GE]: (x, y) => x >= y,
        [SimpleLangParser.EQ]: (x, y) => x === y,
        [SimpleLangParser.NEQ]: (x, y) => x !== y
    }
    private apply_unop = (op, v) => this.unop_microcode[op](v)

    private apply_binop = (op, v2, v1) => this.binop_microcode[op](v1, v2)

    public run(instrs) {
        this.OS = [];
        this.PC = 0;
        this.E = {};
        this.RTS = [];

        //print_code(instrs)
        while (!(instrs[this.PC].tag === 'DONE')) {
            //display("next instruction: ")
            //print_code([instrs[PC]]) 
            //display(PC, "PC: ")
            //print_OS("\noperands:            ");
            //print_RTS("\nRTS:            ");
            const instr = instrs[this.PC]
            console.log("VM executing instr: " + instr.tag.toString())
            this.microcode[instr.tag](instr)
        }
        return this.OS.at(-1);
    }
}

