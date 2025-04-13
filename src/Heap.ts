import { error, display, push, peek, is_boolean, is_null, is_number, is_string, is_undefined, arity } from './Utils';

export class Heap {

    private builtins
    private constants

    constructor(heapsize_words, builtins, constants) {
        this.builtins = builtins;
        this.constants = constants;
        this.heap_size = heapsize_words
        this.free = 0
        this.HEAP = this.heap_make(heapsize_words);
        this.stringPool = {};

        // initialize free list:
        // every free node carries the address
        // of the next free node as its first word
        let i = 0
        for (i = 0; i <= heapsize_words - this.node_size; i = i + this.node_size) {
            this.heap_set(i, i + this.node_size)
        }
        // the empty free list is represented by -1
        this.heap_set(i - this.node_size, -1)
        this.allocate_literal_values();

    }

    // HEAP is an array of bytes (JS ArrayBuffer)

    private word_size = 8

    // heap_make allocates a heap of given size 
    // (in bytes) and returns a DataView of that, 
    // see https://www.javascripture.com/DataView
    public heap_make = words => {
        const data = new ArrayBuffer(words * this.word_size)
        const view = new DataView(data)
        return view
    }

    // for convenience, HEAP is global variable
    // initialized in initialize_machine()
    private HEAP
    private heap_size

    // for debugging: display all bits of the heap
    // const heap_display = s => {
    //     display("", "heap: " + s)
    //     for (let i = 0; i < heap_size; i++) {
    //         display(word_to_string(heap_get(i)), 
    //                 stringify(i) + " " +
    //                 stringify(heap_get(i)) +
    //                 " ")
    //     }
    // }

    // private mark_bit_offset = 7 // use last unused byte

    // private MARKED = 1
    // private UNMARKED = 0 // unused byte is 0-initialized

    // const heap_get_mark_bit = address =>
    //     heap_get_byte_at_offset(address, mark_bit_offset)

    // const heap_set_mark_bit = (address, value) =>
    //     heap_set_byte_at_offset(address, mark_bit_offset, value)

    // const mark = v => {
    //     if (v === undefined) return
    //     if (v >= heap_size) return
    //     if (heap_get_mark_bit(v) === UNMARKED) {
    //         heap_set_mark_bit(v, MARKED)
    //         for (let i = 0; i < heap_get_number_of_children(v); i++) {
    //             const c = heap_get_child(v, i)
    //             mark(c)
    //         }
    //     }
    // }

    // private HEAPBOTTOM = 0

    public free_node = (addr) => {
        // point the new node to the head of the free list
        this.heap_set(addr, this.free)
        // set it as the new head
        this.free = addr
    }

    // const sweep = () => {
    //     let v = HEAPBOTTOM
    //     while (v < heap_size) {
    //         if (heap_get_mark_bit(v) === UNMARKED) {
    //             free_node(v)
    //         } else {
    //             heap_set_mark_bit(v, UNMARKED)
    //         }
    //         v = v + node_size
    //     }
    // }

    // const mark_stack = s => {
    //     for (const v of s) {
    //         mark(v)
    //     }
    // }

    // const mark_roots = () => {
    //     mark_stack(OS)
    //     mark_stack(RTS)
    //     const literals = [True, False, Null, Undefined, Unassigned]
    //     mark_stack(literals)
    // }

    // const mark_sweep = () => {
    //     mark_roots()
    //     sweep()
    //     if (free === -1) {
    //         error("heap memory exhausted")
    //     }
    // }

    // heap_allocate allocates a given number of words 
    // on the heap and marks the first word with a 1-byte tag.
    // the last two bytes of the first word indicate the number
    // of children (addresses) that follow the tag word:
    // [1 byte tag, 4 bytes payload (depending on node type), 
    //  2 bytes #children, 1 byte unused] 
    // Note: payload depends on the type of node
    private size_offset = 5

    private node_size = 1000

    private free

    private heap_allocate = (tag, size) => {
        // if (size > this.node_size) {
        //     error("limitation: nodes cannot be larger than 10 words")
        // }
        // a value of -1 in free indicates the
        // end of the free list
        if (this.free === -1) {
            // mark_sweep()
            error("Ran out of memory")
        }
        const address = this.free
        // get address of next free node
        this.free = this.heap_get(this.free)
        // this.free += size
        this.HEAP.setInt8(address * this.word_size, tag)
        this.HEAP.setUint16(address * this.word_size +
            this.size_offset,
            size)
        return address
    }

    // private heap_already_copied = node =>
    //     this.heap_get_forwarding_address(node) >= to_space
    //     &&
    //     this.heap_get_forwarding_address(node) <= this.free

    private heap_set_forwarding_address = (node, address) =>
        this.HEAP.setInt32(node * this.word_size, address)

    private heap_get_forwarding_address = node =>
        this.HEAP.getInt32(node * this.word_size)

    // get and set a word in heap at given address
    private heap_get = address =>
        this.HEAP.getFloat64(address * this.word_size)

    private heap_set = (address, x) => {
        this.HEAP.setFloat64(address * this.word_size, x)
        // try {
        //     console.log("setting " + x + " (" + this.address_to_JS_value(address - 1) + ") at [" + address + "]")
        // } catch (e) {
        //     console.log("setting " + x + " (" + this.address_to_JS_value(address) + ") at [" + address + "]")
        // }
    }

    // child index starts at 0
    private heap_get_child = (address, child_index) =>
        this.heap_get(address + 1 + child_index)

    public heap_set_child = (address, child_index, value) =>
        this.heap_set(address + 1 + child_index, value)

    private heap_get_tag = address =>
        this.HEAP.getInt8(address * this.word_size)

    private heap_get_size = address =>
        this.HEAP.getUint16(address * this.word_size +
            this.size_offset)

    // the number of children is one less than the size 
    // except for number nodes:
    //                 they have size 2 but no children
    private heap_get_number_of_children = address =>
        this.heap_get_tag(address) === this.Number_tag
            ? 0
            : this.heap_get_size(address) - 1

    // access byte in heap, using address and offset
    private heap_set_byte_at_offset =
        (address, offset, value) =>
            this.HEAP.setUint8(address * this.word_size + offset, value)

    private heap_get_byte_at_offset =
        (address, offset) =>
            this.HEAP.getUint8(address * this.word_size + offset)

    // access byte in heap, using address and offset
    private heap_set_2_bytes_at_offset =
        (address, offset, value) =>
            this.HEAP.setUint16(address * this.word_size + offset, value)

    private heap_get_2_bytes_at_offset =
        (address, offset) =>
            this.HEAP.getUint16(address * this.word_size + offset)

    private heap_set_4_bytes_at_offset = (address, offset, value) =>
        this.HEAP.setUint32(address * this.word_size + offset, value);

    private heap_get_4_bytes_at_offset = (address, offset) =>
        this.HEAP.getUint32(address * this.word_size + offset);

    // for debugging: return a string that shows the bits
    // of a given word
    private word_to_string = word => {
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setFloat64(0, word);
        let binStr = '';
        for (let i = 0; i < 8; i++) {
            binStr += ('00000000' +
                view.getUint8(i).toString(2)).slice(-8) +
                ' ';
        }
        return binStr
    }

    // values 

    // All values are allocated on the heap as nodes. The first 
    // word of the node is a header, and the first byte of the 
    // header is a tag that identifies the type of node

    // a little trick: tags are all negative so that we can use
    // the first 4 bytes of the header as forwarding address
    // in garbage collection: If the (signed) Int32 is
    // non-negative, the node has been forwarded already.

    // Use uncommon numbers instead of 0 and 1 to prevent mis-identifying when printing
    private False_tag = 100
    private True_tag = 101
    private Number_tag = 2
    private Null_tag = 3
    private Unassigned_tag = 4
    private Undefined_tag = 5
    private Blockframe_tag = 6
    private Callframe_tag = 7
    private Closure_tag = 8
    private Frame_tag = 9  // 0000 1001
    private Environment_tag = 10 // 0000 1010
    private Pair_tag = 11
    private Builtin_tag = 12
    private String_tag = 13; 

    // Record<string, tuple(number, string)< where the key is the hash of the string
    // and the value is a tuple of the address of the string and the string itself
    private stringPool = {}; 

    // all values (including literals) are allocated on the heap.

    // We allocate canonical values for 
    // true, false, undefined, null, and unassigned
    // and make sure no such values are created at runtime

    // boolean values carry their value (0 for false, 1 for true)
    // in the byte following the tag

    private False
    public is_False = address =>
        this.heap_get_tag(address) === this.False_tag
    private True
    public is_True = address =>
        this.heap_get_tag(address) === this.True_tag

    public is_Boolean = address =>
        this.is_True(address) || this.is_False(address)

    private Null
    public is_Null = address =>
        this.heap_get_tag(address) === this.Null_tag

    public Unassigned
    public is_Unassigned = address =>
        this.heap_get_tag(address) === this.Unassigned_tag

    private Undefined
    public is_Undefined = address =>
        this.heap_get_tag(address) === this.Undefined_tag

    private allocate_literal_values = () => {
        this.False = this.heap_allocate(this.False_tag, 1)
        this.True = this.heap_allocate(this.True_tag, 1)
        this.Null = this.heap_allocate(this.Null_tag, 1)
        this.Unassigned = this.heap_allocate(this.Unassigned_tag, 1)
        this.Undefined = this.heap_allocate(this.Undefined_tag, 1)
    }

    // builtins: builtin id is encoded in second byte
    // [1 byte tag, 1 byte id, 3 bytes unused, 
    //  2 bytes #children, 1 byte unused]
    // Note: #children is 0

    public is_Builtin = address =>
        this.heap_get_tag(address) === this.Builtin_tag

    private heap_allocate_Builtin = id => {
        const address = this.heap_allocate(this.Builtin_tag, 1)
        this.heap_set_byte_at_offset(address, 1, id)
        return address
    }

    public heap_get_Builtin_id = address =>
        this.heap_get_byte_at_offset(address, 1)

    // closure
    // [1 byte tag, 1 byte arity, 2 bytes pc, 1 byte unused, 
    //  2 bytes #children, 1 byte unused] 
    // followed by the address of env
    // note: currently bytes at offset 4 and 7 are not used;
    //   they could be used to increase pc and #children range

    public heap_allocate_Closure = (arity, pc, env) => {
        const address = this.heap_allocate(this.Closure_tag, 2)
        this.heap_set_byte_at_offset(address, 1, arity)
        this.heap_set_2_bytes_at_offset(address, 2, pc)
        this.heap_set(address + 1, env)
        // console.log("allocating <closure:pc:" + pc + "> at [" + address + "]")
        return address
    }

    private heap_get_Closure_arity = address =>
        this.heap_get_byte_at_offset(address, 1)

    public heap_get_Closure_pc = address =>
        this.heap_get_2_bytes_at_offset(address, 2)

    public heap_get_Closure_environment = address =>
        this.heap_get_child(address, 0)

    private is_Closure = address =>
        this.heap_get_tag(address) === this.Closure_tag

    // block frame 
    // [1 byte tag, 4 bytes unused, 
    //  2 bytes #children, 1 byte unused] 

    public heap_allocate_Blockframe = env => {
        const address = this.heap_allocate(this.Blockframe_tag, 2)
        this.heap_set(address + 1, env)
        return address
    }

    public heap_get_Blockframe_environment = address =>
        this.heap_get_child(address, 0)

    public is_Blockframe = address =>
        this.heap_get_tag(address) === this.Blockframe_tag

    // call frame 
    // [1 byte tag, 1 byte unused, 2 bytes pc, 
    //  1 byte unused, 2 bytes #children, 1 byte unused] 
    // followed by the address of env

    public heap_allocate_Callframe = (env, pc) => {
        const address = this.heap_allocate(this.Callframe_tag, 2)
        this.heap_set_2_bytes_at_offset(address, 2, pc)
        this.heap_set(address + 1, env)
        return address
    }

    public heap_get_Callframe_environment = address =>
        this.heap_get_child(address, 0)

    public heap_get_Callframe_pc = address =>
        this.heap_get_2_bytes_at_offset(address, 2)

    public is_Callframe = address =>
        this.heap_get_tag(address) === this.Callframe_tag

    // strings:
    // [1 byte tag, 4 byte hash to stringPool,
    // 2 bytes #children, 1 byte unused]
    // Note: #children is 0

    // Hash any string to a 32-bit unsigned integer
    private hashString = (str) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) + hash + char;
            hash = hash & hash;
        }
        return hash >>> 0;
    };

    public is_String = (address) =>
        this.heap_get_tag(address) === this.String_tag;

    public heap_allocate_String = (string) => {
        const hash = this.hashString(string);
        const a = this.stringPool[hash];

        if (a !== undefined) {
            let i;
            for (i = 0; i < a.length; i++) {
                if (a[i].string === string)
                    return a[i].address;
            }
            const address = this.heap_allocate(this.String_tag, 2);
            this.heap_set_4_bytes_at_offset(address, 1, hash);
            this.heap_set_2_bytes_at_offset(address, 5, i);
            a[i] = { address, string };
            return address;
        }

        const address = this.heap_allocate(this.String_tag, 2);
        this.heap_set_4_bytes_at_offset(address, 1, hash);
        this.heap_set_2_bytes_at_offset(address, 5, 0);

        // Store {address, string} in the string pool under hash at index 0
        this.stringPool[hash] = [{ address, string }];

        return address;
    };

    private heap_get_string_hash = (address) =>
        this.heap_get_4_bytes_at_offset(address, 1);

    private heap_get_string_index = (address) =>
        this.heap_get_2_bytes_at_offset(address, 5);

    private heap_get_string = (address) =>
        this.stringPool[this.heap_get_string_hash(address)]
        [this.heap_get_string_index(address)]
            .string;

    // environment frame
    // [1 byte tag, 4 bytes unused, 
    //  2 bytes #children, 1 byte unused] 
    // followed by the addresses of its values

    public heap_allocate_Frame = number_of_values =>
        this.heap_allocate(this.Frame_tag, number_of_values + 1)

    private heap_Frame_display = address => {
        // display("", "Frame:")
        const size = this.heap_get_number_of_children(address)
        display(size, "frame size:")
        for (let i = 0; i < size; i++) {
            console.log("---------")
            display(i, "value address:")
            const value =
                this.heap_get_child(address, i)
            display(value, "addr :")
            display(this.address_to_JS_value(value), "deref value:")
            // display(this.word_to_string(value), "value word:")
        }
    }

    // environment
    // [1 byte tag, 4 bytes unused, 
    //  2 bytes #children, 1 byte unused] 
    // followed by the addresses of its frames

    public heap_allocate_Environment = number_of_frames =>
        this.heap_allocate(this.Environment_tag, number_of_frames + 1)

    // access environment given by address 
    // using a "position", i.e. a pair of 
    // frame index and value index
    public heap_get_Environment_value =
        (env_address, position) => {
            const [frame_index, value_index] = position
            const frame_address =
                this.heap_get_child(env_address, frame_index)
            return this.heap_get_child(
                frame_address, value_index)
        }

    public heap_set_Environment_value =
        (env_address, position, value) => {
            const [frame_index, value_index] = position
            const frame_address =
                this.heap_get_child(env_address, frame_index)
            this.heap_set_child(
                frame_address, value_index, value)
        }

    // extend a given environment by a new frame: 
    // create a new environment that is bigger by 1
    // frame slot than the given environment.
    // copy the frame Addresses of the given 
    // environment to the new environment.
    // enter the address of the new frame to end 
    // of the new environment
    public heap_Environment_extend =
        (frame_address, env_address) => {
            const old_size =
                this.heap_get_size(env_address)
            const new_env_address =
                this.heap_allocate_Environment(old_size)
            let i
            for (i = 0; i < old_size - 1; i++) {
                this.heap_set_child(
                    new_env_address, i,
                    this.heap_get_child(env_address, i))
            }
            this.heap_set_child(new_env_address, i, frame_address)
            return new_env_address
        }

    // for debuggging: display environment
    public heap_Environment_display = env_address => {
        const size = this.heap_get_number_of_children(
            env_address)
        // display("", "Environment:")
        display(size, "environment size:")
        for (let i = 0; i < size; i++) {
            console.log("==========")
            display(i, "frame index:")
            const frame = this.heap_get_child(env_address, i)
            this.heap_Frame_display(frame)
        }
    }

    // pair
    // [1 byte tag, 4 bytes unused, 
    //  2 bytes #children, 1 byte unused] 
    // followed by head and tail addresses, one word each
    private heap_allocate_Pair = (hd, tl) => {
        const pair_address = this.heap_allocate(this.Pair_tag, 3)
        this.heap_set_child(pair_address, 0, hd)
        this.heap_set_child(pair_address, 1, tl)
        return pair_address
    }

    private is_Pair = address =>
        this.heap_get_tag(address) === this.Pair_tag

    // number
    // [1 byte tag, 4 bytes unused, 
    //  2 bytes #children, 1 byte unused] 
    // followed by the number, one word
    // note: #children is 0

    private heap_allocate_Number = n => {
        const number_address = this.heap_allocate(this.Number_tag, 2)
        // console.log("allocating " + n + " at [" + number_address + "]")
        this.heap_set(number_address + 1, n)
        return number_address
    }

    private is_Number = address =>
        this.heap_get_tag(address) === this.Number_tag

    //
    // conversions between addresses and JS_value
    //

    public address_to_JS_value = x =>
        this.is_Boolean(x)
            ? (this.is_True(x) ? true : false)
            : this.is_Number(x)
                ? this.heap_get(x + 1)
                : this.is_Undefined(x)
                    ? undefined
                    : this.is_Unassigned(x)
                        ? "<unassigned>"
                        : this.is_Null(x)
                            ? null
                            : this.is_String(x)
                            ? this.heap_get_string(x)
                            // : this.is_Pair(x)
                            // ? [
                            //     this.address_to_JS_value(this.heap_get_child(x, 0)),
                            //     this.address_to_JS_value(this.heap_get_child(x, 1))
                            //     ]
                            : this.is_Closure(x)
                                ? "<closure>"
                                : this.is_Blockframe(x)
                                    ? "<blockframe>"
                                    : this.is_Callframe(x)
                                        ? "<callframe>"
                                        : this.is_Builtin(x)
                                            ? "<builtin>"
                                            : "unknown word tag: " + this.word_to_string(x)

    public JS_value_to_address = x =>
        is_boolean(x)
            ? (x ? this.True : this.False)
            : is_number(x)
                ? this.heap_allocate_Number(x)
                : is_undefined(x)
                    ? this.Undefined
                    : is_null(x)
                        ? this.Null
                        : is_string(x)
                        ? this.heap_allocate_String(x)
                        // : is_pair(x)
                        // ? this.heap_allocate_Pair(
                        //     this.JS_value_to_address(head(x)),
                        //     this.JS_value_to_address(tail(x)))
                        : "unknown word tag: " + this.word_to_string(x)


    public allocate_builtin_frame = () => {
        const builtin_values = Object.values(this.builtins)
        const frame_address =
            this.heap_allocate_Frame(builtin_values.length)
        for (let i = 0; i < builtin_values.length; i++) {
            const builtin: any = builtin_values[i];
            this.heap_set_child(
                frame_address,
                i,
                this.heap_allocate_Builtin(builtin.id))
        }
        return frame_address
    }

    public allocate_constant_frame = () => {
        const constant_values = Object.values(this.constants)
        const frame_address =
            this.heap_allocate_Frame(constant_values.length)
        for (let i = 0; i < constant_values.length; i++) {
            const constant_value = constant_values[i];
            if (typeof constant_value === "undefined") {
                this.heap_set_child(frame_address, i, this.Undefined)
            } else {
                this.heap_set_child(
                    frame_address,
                    i,
                    this.heap_allocate_Number(constant_value))
            }
        }
        return frame_address
    }



    // compile-time frames only need synbols (keys), no values
    private builtin_compile_frame
    private constant_compile_frame
    private global_compile_environment

}