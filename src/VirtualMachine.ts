import { Heap } from './Heap';
import { error, display, push, peek, is_boolean, is_null, is_number, is_string, is_undefined, arity, pprint } from './Utils';
import { DustParser } from './parser/src/DustParser';

export class VirtualMachine {
    private OS: any[];
    private PC: number;
    private E;
    private RTS: any[];
    private heap: Heap;
    private instrs: any[];
    private custom_builtins;

    constructor(custom_builtins) {
        this.custom_builtins = custom_builtins
        this.init_builtins()
    }

    private get_display_func = () => {
        return this.custom_builtins['display']
    }

    private free = (addr) => {
        const val = this.heap.address_to_JS_value(addr);
        // Do not free literals such as True, False
        // Should not free the last value-producing statement
        this.heap.free_node(addr)
        this.get_display_func()('Freed "' + val + '" from [' + addr + ']');
    }

    private free_variables = (positions) => {
        for (const pos of positions) {
            const addr = this.heap.heap_get_Environment_value(this.E, pos);
            this.free(addr)
        }
    }

    private microcode = {
        LDC:
            instr => {
                const addr = this.heap.JS_value_to_address(instr.val);
                if (this.heap.is_String(addr)) {
                    this.get_display_func()('Allocated "' + instr.val + '" at [' + addr + ']');
                }
                return push(this.OS, addr);
            },
        UNOP:
            instr =>
                push(this.OS, this.apply_unop(instr.sym, this.OS.pop())),
        BINOP:
            instr =>
                push(this.OS,
                    this.apply_binop(instr.sym, this.OS.pop(), this.OS.pop())),
        POP:
            instr =>
                this.OS.pop(),
        JOF:
            instr =>
                this.PC = this.heap.is_True(this.OS.pop()) ? this.PC : instr.addr,
        GOTO:
            instr =>
                this.PC = instr.addr,
        ENTER_SCOPE:
            instr => {
                push(this.RTS, this.heap.heap_allocate_Blockframe(this.E))
                const frame_address = this.heap.heap_allocate_Frame(instr.num)
                this.E = this.heap.heap_Environment_extend(frame_address, this.E)
                for (let i = 0; i < instr.num; i++) {
                    this.heap.heap_set_child(frame_address, i, this.heap.Unassigned)
                }
            },
        DROP:
            instr => {
                // TOOD: more reliable way to check
                // dont pop if it is the last value-producing statement
                const to_free = instr.to_free;
                this.free_variables(to_free.map(x => x.pos));
            },
        DROP_POP:
            instr => {
                // TODO: dont pop if it is the last value-producing statement
                // pop from the OS and free the value
                this.free(this.OS.pop())
            },
        EXIT_SCOPE:
            instr => {
                const blockframe = this.RTS.pop()
                this.E = this.heap.heap_get_Blockframe_environment(blockframe)
                // this.free(blockframe)
            },
        LD:
            instr => {
                const val = this.heap.heap_get_Environment_value(this.E, instr.pos)
                if (this.heap.is_Unassigned(val))
                    error("access of unassigned variable")
                push(this.OS, val)
            },
        ASSIGN:
            instr =>
                this.heap.heap_set_Environment_value(this.E, instr.pos, peek(this.OS, 0)),
        LDF:
            instr => {
                const closure_address =
                    this.heap.heap_allocate_Closure(
                        instr.arity, instr.addr, this.E)
                push(this.OS, closure_address)
            },
        CALL:
            instr => {
                const arity = instr.arity
                const fun = peek(this.OS, arity)
                if (this.heap.is_Builtin(fun)) {
                    return this.apply_builtin(this.heap.heap_get_Builtin_id(fun))
                }
                const new_PC = this.heap.heap_get_Closure_pc(fun)
                const new_frame = this.heap.heap_allocate_Frame(arity)
                for (let i = arity - 1; i >= 0; i--) {
                    this.heap.heap_set_child(new_frame, i, this.OS.pop())
                }
                this.OS.pop() // pop fun
                push(this.RTS, this.heap.heap_allocate_Callframe(this.E, this.PC))
                this.E = this.heap.heap_Environment_extend(
                    new_frame,
                    this.heap.heap_get_Closure_environment(fun))
                this.PC = new_PC
            },
        TAIL_CALL:
            instr => {
                const arity = instr.arity
                const fun = peek(this.OS, arity)
                if (this.heap.is_Builtin(fun)) {
                    return this.apply_builtin(this.heap.heap_get_Builtin_id(fun))
                }
                const new_PC = this.heap.heap_get_Closure_pc(fun)
                const new_frame = this.heap.heap_allocate_Frame(arity)
                for (let i = arity - 1; i >= 0; i--) {
                    this.heap.heap_set_child(new_frame, i, this.OS.pop())
                }
                this.OS.pop() // pop fun
                // don't push on RTS here
                this.E = this.heap.heap_Environment_extend(
                    new_frame,
                    this.heap.heap_get_Closure_environment(fun))
                this.PC = new_PC
            },
        RESET:
            instr => {
                // keep popping...
                const top_frame = this.RTS.pop()
                if (this.heap.is_Callframe(top_frame)) {
                    // ...until top frame is a call frame
                    this.PC = this.heap.heap_get_Callframe_pc(top_frame)
                    this.E = this.heap.heap_get_Callframe_environment(top_frame)
                } else {
                    this.PC--
                }
                // this.free(top_frame)
            }
    }


    private unop_microcode = {
        '-': x => - x,
        '!': x => is_boolean(x)
            ? !x
            : error('! expects boolean, found: ' + x)
    }

    private binop_microcode = {
        '+': (x, y) => (is_number(x) && is_number(y))
            ? x + y
            : (is_string(x) && is_string(y))
                ? x + y
                : error("+ expects two numbers or two strings"),
        // todo: add error handling to JS for the following, too
        '*': (x, y) => x * y,
        '-': (x, y) => x - y,
        '/': (x, y) => x / y,
        '<': (x, y) => x < y,
        '>': (x, y) => x > y,
        '<=': (x, y) => x <= y,
        '>=': (x, y) => x >= y,
        '==': (x, y) => x === y,
        '!=': (x, y) => x !== y
    }

    // v2 is popped before v1
    private apply_binop = (op, v2, v1) =>
        this.heap.JS_value_to_address(this.binop_microcode[op]
            (this.heap.address_to_JS_value(v1),
                this.heap.address_to_JS_value(v2)))

    private apply_unop = (op, v) =>
        this.heap.JS_value_to_address(this.unop_microcode[op]
            (this.heap.address_to_JS_value(v)))

    private builtin_implementation = {
        display: (custom_fn) => () => {
            const fn = custom_fn ? custom_fn : display
            const address = this.OS.pop()
            fn(this.heap.address_to_JS_value(address))
            return address
        },
    }

    public get_builtins = () =>
        this.builtins;

    public get_constants = () =>
        this.constants;

    private builtins = {}
    private builtin_array = []
    private init_builtins = () => {
        let i = 0
        for (const key in this.builtin_implementation) {
            const custom_fn = this.custom_builtins[key]
            const builtin_fn = this.builtin_implementation[key](custom_fn)
            this.builtins[key] =
            {
                tag: 'BUILTIN',
                id: i,
                arity: arity(builtin_fn)
            }
            this.builtin_array[i++] = builtin_fn
        }
    }

    private apply_builtin = builtin_id => {
        // display(builtin_id, "apply_builtin: builtin_id:")
        const result = this.builtin_array[builtin_id]()
        this.OS.pop() // pop fun
        push(this.OS, result)
    }

    private initialize_machine(heapsize_words) {
        this.OS = [];
        this.PC = 0;
        this.RTS = [];
        this.heap = new Heap(heapsize_words, this.builtins, this.constants);
        const builtins_frame = this.heap.allocate_builtin_frame()
        const constants_frame = this.heap.allocate_constant_frame()
        this.E = this.heap.heap_allocate_Environment(0)
        this.E = this.heap.heap_Environment_extend(builtins_frame, this.E)
        this.E = this.heap.heap_Environment_extend(constants_frame, this.E)
    }

    private constants = {
    }


    public run(instrs) {
        this.instrs = instrs
        this.initialize_machine(10000000);
        //print_code(instrs)
        while (!(this.instrs[this.PC].tag === 'DONE')) {
            // display("next instruction: ")
            pprint(instrs[this.PC])
            //process.stdout.write("PC: " + this.PC + ": ")
            //console.log(this.instrs[this.PC])
            //display(PC, "PC: ")
            //print_OS("\noperands:            ");
            //print_RTS("\nRTS:            ");
            const instr = this.instrs[this.PC++]
            this.microcode[instr.tag](instr)
            // console.log("OS: ");
            // this.OS.map((e, i) => {
            //     console.log(i + ": " + e)
            // })
            // this.heap.heap_Environment_display(this.E)
        }
        const ret = this.heap.address_to_JS_value(peek(this.OS, 0));
        return ret
    }
}

