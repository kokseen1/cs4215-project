import { test } from "./TestUtils.js";

export const test_type_mismatch = () => {

    // works (correctly typed declaration)
    test(`let mut y:i32 = 5;`, 5);

    // error (type mismatch in declaration)
    test(`
let mut x:i32 = true; // should be i32 instead
`, `Error: type error in declaration; expected i32, found bool`);


    // works (correctly typed assignment)
    test(`
let mut y = 2;
y = 3;`
        , 3);

    // error (type mismatch in assignment)
    test(`
let mut x = true;      
x = 2; // should be bool instead
`, `Error: type error in assignment; expected bool, found i32`);


    // error (type mismatch between assigned var & DEREFERENCED var)
    test(`
let x = false; 
let z = &x;
let mut a = 1;
a = *z; // cannot assign i32 to bool
`, `Error: type error in assignment; expected i32, found bool`);


    // works (correctly typed function)
    test(`
fn f(a:i32) {}
f(3);
`, undefined);

    // error (function type mismatch between param & arg)
    test(`
fn f(a:i32) {}
f(true); // should be i32 instead
`,
        `Error: type error in application:
expected parameter types: [ i32 ]
actual argument types: [ bool ]`);

    // error (function BORROWING type mismatch between param & arg)
    test(`
fn test(b: bool) {} // missing &
let mut a = false;
test(&a);
`,
        `Error: type error in application:
expected parameter types: [ bool ]
actual argument types: [ & bool ]`);


    // error (param tries to mutable borrow an immutable VARIABLE)
    test(`
fn test(a: & mut i32) {}

let x = 7; // x has to be mut instead
test(& mut x);
`,
        `Error: cannot borrow \`x\` as mutable, as it is not declared as mutable`);

    // error (param tries to mutable borrow an immutable ARGUMENT)
    test(`
fn test(a: & mut i32) {}

let mut x = 7;
test(& x); // shld be mutable borrow instead
`,
        `Error: type error in application:
expected parameter types: [ & mut i32 ]
actual argument types: [ & i32 ]`);

    // works (param immutable borrows a mutable ARGUMENT)
    test(`
fn test(a: & i32) {}

let mut x = 7;
test(& mut x);
`, undefined);


    // error (function wrong return type)
    test(`
fn test(mut a: i32) { // need to specify '-> i32' here, else it defaults to 'void'
    a = 5; 
    return a;
}

let x = 5;
test(x);
`, `Error: type error in function declaration; declared return type: void, actual return type: i32`);

}
