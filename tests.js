import { SimpleLangEvaluator } from './dist/Evaluator.js';

const test = (program, expected_type_or_error) => {
    let t
    try {
        const evaluator = new SimpleLangEvaluator()
        evaluator.init()
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
/*
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
*/

// test: type mismatch (declarations)
test(`let mut y:i32 = 5;`, 5);

test(`
let mut x:i32 = true; // should be i32 instead
`, `Error: type error in declaration; expected i32, found bool`);

// test: type mismatch (assignments)
test(`
let mut y = 2;
y = 3;`
, 3);

test(`
let mut x = true;      
x = 2; // should be bool instead
`, `Error: type error in assignment; expected bool, found i32`);


// test: type mismatch (dereference)
test(`
let x = false; 
let z = &x;
let mut a = 1;
a = *z; // cannot assign i32 to bool
`, `Error: type error in assignment; expected i32, found bool`);

// test: type mismatch (functions)
test(`
fn f(a:i32) {}
f(3);
`, undefined);

test(`
fn f(a:i32) {}
f(true); // should be i32 instead
`, 
`Error: type error in application:
expected parameter types: [ i32 ]
actual argument types: [ bool ]`);

// test: type mismatch (functions w/ borrowing)
test(`
fn test(b: bool) {} // missing &
let mut a = false;
test(&a);
`, 
`Error: type error in application:
expected parameter types: [ bool ]
actual argument types: [ & bool ]`);

// test: type mismatch (fn param tries to mutable borrow an immutable var)
test(`
fn test(a: & mut i32) {}

let x = 7; // x has to be mut instead
test(& mut x);
`, 
`Error: cannot borrow \`x\` as mutable, as it is not declared as mutable`);

// test: type mismatch (fn param is mutable ref BUT arg is immutable ref)
test(`
fn test(a: & mut i32) {}

let mut x = 7;
test(& x); // shld be mutable borrow instead
`, 
`Error: type error in application:
expected parameter types: [ & mut i32 ]
actual argument types: [ & i32 ]`);

// test: type mismatch (function return type)
test(`
fn test(mut a: i32) { // need to specify '-> i32' here, else it defaults to 'void'
    a = 5; 
    return a;
}

let x = 5;
test(x);
`, `Error: type error in function declaration; declared return type: void, actual return type: i32`);

// test: function param can immutable borrow a mutable reference arg
test(`
fn test(a: & i32) {}

let mut x = 7; // x has to be mut instead
test(& mut x);
`, `undefined`);

// test mutability
// test borrowing
// test lifetimes