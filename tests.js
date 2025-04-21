import { SimpleLangEvaluator } from './dist/Evaluator.js';

const test = async (program, expected_type_or_error) => {
    let t
    try {
        const evaluator = new SimpleLangEvaluator()
        await evaluator.init()
        t = evaluator.parse_compile_run(program)
    } catch (x) {
        t = x + ""
    }

    if (t === expected_type_or_error) {
        console.log("pass")
    } else {
        console.log()
        console.log("fail!")
        console.log(program)
        console.log("expected result: " + expected_type_or_error)
        console.log("computed result: " + t)
    }
}

// test: code constructs (i.e. assignments, declarations, conditionals, loops etc)

test("1;", 1);

test("2 + 3;", 5);

test("1; 2; 3;", 3);

test(
    `
let y = 4; 
{
  let x = y + 7; 
  x * 2;
}
  `,
    22,
);

test(
    `
fn f() -> i32 {
  return 1;
}
f();
`,
    1,
);

test(
    `
fn f(x: i32) -> i32 {
  return x;
}
f(33);
`,
    33,
);

test(
    `
fn f(x: i32, y: i32) -> i32 {
  return x - y;
}
f(33, 22);
`,
    11,
);

test(
    `
fn fact(n: i32) -> i32 {
    if (n == 1) {
        return 1;
    } else {
        return n * fact(n - 1);
    }
}
fact(10);
`,
    3628800,
);

test(
    `
fn fact(n: i32) -> i32 {
  return fact_iter(n, 1, 1);
}
fn fact_iter(n: i32, i: i32, acc: i32) -> i32 {
  if (i > n) {
      return acc;
  } else {
      return fact_iter(n, i + 1, acc * i);
  }
}
fact(4);
`,
    24,
);

test(
    `
fn fact(n: i32) -> i32 {
  return fact_iter(n, 1, 1);
}
fn fact_iter(n: i32, i: i32, acc: i32) -> i32 {
  if i > n {
    return acc;
  } else {
    return fact_iter(n, i + 1, acc * i);
  }
}
fact(4);
`,
    24,
);

// test(
//     `
// display(10);
// `,
//     10,
// );

test("while (false) { 1; }", undefined);

test("let mut x = 0; x = 1; while (x < 10) { 1; x = x + 1; } x;", 10);

const loop2 = `
let mut x = 0;
let mut i = 0;
while (i < 100) {
  let mut j = 0;
  while (j < 100) {
      x = x + i + j;
      j = j + 1;
  }
  i = i + 1;
}
x;
`;
test(loop2, 990000);

const loop3 = `
let x = 0;
let mut i = 0;
while (i < 1000) {
  let y = 1;
  i = i + 1;
}
i;
`;
test(loop3, 1000);

test("let mut i = 0; while (i < 10) { i = i + 1; }", undefined);

test(
    `
! false;
`,
    true,
);

test(`1 == 1;`, true);

test(
    `
fn f(x: i32) -> i32 {
  let y = 5;
  return x + y;
}
f(4);
`,
    9,
);

test(`String::from("a");`, "a");

test(
    `
fn what_is_the_best_programming_language() -> String {
  return String::from("Rust");
}
what_is_the_best_programming_language();
`,
    "Rust",
);


// test: ownership

test(`
let x = String::from("abc");
let y = x; // x loses ownership
x;
    `, "Error: Error: use of moved value x");


test(`
let x = String::from("abc");
let y = x; // x loses ownership
y;
    `, "abc");

test(`
fn f(a: String) { // void return
    // a gains ownership
    // and is dropped upon exit of fn scope
}

let x = String::from("abc");
f(x); // x loses ownership
x;
    `, "Error: Error: use of moved value x");

test(`
fn f(a: String) -> String {
    // a gains ownership
    return a; // returns ownership to caller
}

let x = String::from("abc");
let y = f(x);
y;
    `, "abc");

test(`
let x = String::from("abc");
{
    let y = x;
}
    x;
    `, "Error: Error: use of moved value x");

test(`
fn g(b: String) -> String {
    // b gains ownership
    let c = String::from("xyz");
    return c;
}

fn f(a: String) -> String {
    // a gains ownership
    let b = g(a);
    return b;
}

let x = String::from("abc");
let y = f(x);
y;
    `, "xyz");

test(`
let a = String::from("apple");
let b = String::from("banana");

if true {
    let c = a; // ownership of a moves to c
    if true {
        let d = b; // ownership of b moves to d
    }
}
b; // attempting to use b after ownership has been moved
    `, "Error: Error: use of moved value b");

test(`let mut a = String::from("apple");
if true {
    let b = a; // ownership of a moves to b
    a = String::from("orange"); // reassigns ownership of a
}
a; // ownership has been reassigned, so a can still be used
    `, "orange");


// test: type mismatch

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

let mut x = 7; // x has to be mut instead
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


// test: mutability

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


// test: borrowing

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


// test: borrowing (blocks)

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


// test: borrowing (functions)

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


// test: lifetimes (blocks)
test(`
let mut y = 3;
let mut r = &mut y;
{
    let mut x = 5;
    r = &mut x;
}
*r; // error since lifetime of x ended
`, `Error: unbound name: x`);

test(`
let mut y = 3;
let mut r = &mut y;
{
    let mut x = 5;
    r = &mut x; // works since x lifetime is not over
}
`, 5);