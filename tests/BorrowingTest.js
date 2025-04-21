import { test } from "./TestUtils.js";

export const test_borrowing = () => {

    // works (multiple immutable borrow an IMMUTABLE var)
    test(`
let x = 5; // immutable variable
let y = & x; // immutable borrow
let z = & x; // immutable borrow
`, 5);

    // works (multiple immutable borrow a MUTABLE var)
    test(`
let mut k = 5; // mutable variable
let l = & k; // immutable borrow
let z = & k; // immutable borrow
`, 5);

    // works (single mutable borrow a MUTABLE var)
    test(`
let mut a = 5; // mutable variable
let b = & mut a; // mutable borrow
`, 5);

    // error (MUTABLE borrow an IMMUTABLE var)
    test(`
let x = 5; // immutable variable
let z = & mut x; // mutable borrow
`, `Error: cannot borrow \`x\` as mutable, as it is not declared as mutable`);

    // error (multiple MUTABLE borrow a MUTABLE var)
    test(`
let mut x = 5; // mutable variable
let y = & mut x; // mutable borrow
let z = & mut x; // mutable borrow (not allowed!)
`, `Error: cannot borrow \`x\` as mutable more than once at a time`);

    // error (cannot have immutable borrow if there's mutable borrow)
    test(`
let mut x = 5; // mutable variable
let y = & mut x; // mutable borrow
let z = & x; // immutable borrow (error)
`, `Error: cannot borrow \`x\` as immutable because it is also borrowed as mutable`);

    // error (cannot have mutable borrow if there's immutable borrow)
    test(`
let mut x = 5; // mutable variable
let y = & x; // immutable borrow
let z = & mut x; // mutable borrow (error)
`, `Error: cannot borrow \`x\` as mutable because it is also borrowed as immutable`);

}

export const test_borrowing_with_blocks = () => {

    // works (scoped borrowing)
    test(`
let mut x = 5;
{
    let mut z = & mut x;
}
let y = & mut x; // shld forget the MUTABLE_COUNT in scope above
`, 5);

    // error (multiple scoped mutable borrows)
    test(`
let mut x = 5;
{
    let z = & mut x;
    {
        let a = & mut x; // error here
    }
}
let y = & mut x;
`, `Error: cannot borrow \`x\` as mutable more than once at a time`);

}

export const test_borrowing_with_functions = () => {

    // error (multiple mutable borrows, involving function argument)
    test(`
fn test(mut a: & mut i32) {}

let mut x = 1;
let b = & mut x;
test(& mut x);
`, `Error: cannot borrow \`x\` as mutable more than once at a time`);

    // error (both mutable and immutable borrow, involving function argument)
    test(`
fn test(mut a: & i32) {}

let mut x = 1;
let b = & mut x;
test(& x);
`, `Error: cannot borrow \`x\` as immutable because it is also borrowed as mutable`);

    // error (trying to borrow an immutable var as mutable, involving function argument)
    test(`
fn test(mut a: & mut i32) {}

let x = 1;
test(& mut x); // should be 'test(& x);' insteaad
`, `Error: cannot borrow \`x\` as mutable, as it is not declared as mutable`);

    // works (SEQUENTIAL mutable borrow of same reference)
    test(`
fn test(mut a: & mut i32) {}

let mut x = 1;
test(& mut x);
test(& mut x); // should work!
`, undefined);

}
