export const error = msg => {
    throw new Error(msg)
}

export const push = (array, ...items) => {
    for (let item of items) {
        array.push(item)
    }
    return array
}

export const peek = (array, address) =>
    array.slice(-1 - address)[0]

export const display = (...args) => {
    if (args.length === 1) {
        console.log(args[0]);
    } else if (args.length === 2) {
        const [value, msg] = args;
        console.log(msg, value);
    } else {
        console.log(...args);
    }
};

export const is_number = (x) =>
    typeof x === 'number'

export const is_string = x =>
    typeof x === 'string'

export const is_boolean = x =>
    typeof x === 'boolean'

export const is_undefined = (x) =>
    x === undefined

export const is_null = (x) =>
    x === null

export const arity = (fun) =>
    fun.length

export const head = (z) =>
    z(0)

export const tail = (z) =>
    z(1)

export const pair = (x, y) => (m) =>
    m === 0
        ? x
        : m === 1
            ? y
            : (() => { throw new Error(`argument not 0 or 1 -- pair: ${m}`); })();

export const pprint = (e) =>
    console.dir(e, { depth: null, colors: true });

export const lookup_type = (val) =>
    is_number(val)
        ? "i32"
        : is_boolean(val)
            ? "bool"
            : is_undefined(val)
                ? "undefined"
                : is_string(val)
                    ? "String"
                    : error("unknown literal: " + val)
