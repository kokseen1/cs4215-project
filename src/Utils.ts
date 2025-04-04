const error = msg => {
    throw new Error(msg)
}

const push = (array, ...items) => {
    for (let item of items) {
        array.push(item)
    }
    return array
}

const display = (...msg) =>
    console.log(...msg)

const is_number = (x) =>
    typeof x === 'number'

const is_string = x =>
    typeof x === 'string'

const is_boolean = x =>
    typeof x === 'boolean'

const is_undefined = (x) =>
    x === undefined

const is_null = (x) =>
    x === null