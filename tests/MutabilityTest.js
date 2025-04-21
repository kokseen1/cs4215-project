import { test } from "./TestUtils.js";

export const test_mutability = () => {

    // work (redeclaring (im/mutable) as (im/mutable) 4-ways)
    test(`
let a = 1;
let a = 2;

let mut b = 1;
let b = 2;

let c = 1;
let mut c = 2;

let mut d = 1;
let mut d = 2;
`, 2);


    // error (trying to modify immutable var)
    test(`
let a = 1;
a = 2;
`, `Error: cannot assign twice to immutable variable \`a\``);

    // works (modify mutable var)
    test(`
let mut a = 1;
a = 2;
`, 2);

    // error (trying to modify an immutable reference)
    test(`
let x = false;
let z = & x;
*z = true;
`, `Error: cannot assign to \`*z\`, which is behind a \`&\` reference`);


    // works (modify mutable parameter)
    test(`
fn test(a: i32) -> i32 {
    a = 5;
    return a;
}
`, `Error: cannot assign to immutable argument \`a\``);

    // error (trying to modify immutable parameter)
    test(`
fn test(mut a: i32) -> i32 {
    a = 5;
    return a;
}
`, "<closure>");

    // error (trying to modify an immutable reference parameter)
    test(`
fn test(a: & i32, b: bool) {
    *a = 5;
}
`, `Error: cannot assign to \`*a\`, which is behind a \`&\` reference`);

}