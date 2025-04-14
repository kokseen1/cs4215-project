import { SimpleLangEvaluator } from './dist/Evaluator.js';

const test = (program, expected_type_or_error) => {
    console.log()
    let t
    try {
        t = new SimpleLangEvaluator().parse_compile_run(program);
    } catch (x) {
        t = x + ""
    }
    if (t === expected_type_or_error) {
        console.log("pass")
    } else {
        console.log("Test case fails; test program:")
        console.log(program)
        console.log("expected result: " + expected_type_or_error)
        console.log("computed result: " + t)
    }
}

// test cases

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
    if n == 1 {
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

test("let x = 0; x = 1; while (x < 10) { 1; x = x + 1; } x;", 10);

const loop2 = `
let x = 0;
let i = 0;
while (i < 100) {
  let j = 0;
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
let i = 0;
while (i < 1000) {
  let y = 1;
  i = i + 1;
}
i;
`;
test(loop3, 1000);

test("let i = 0; while (i < 10) { i = i + 1; }", undefined);

test(
    `
! false;
`,
    true,
);

test(`true == true;`, true);

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

// ownership tests

test(`
let x = String::from("abc");
let y = x; // x loses ownership
x;
    `, "Error: Error: use of moved value x");

test(`
fn f(a: String) {
    // a gains ownership
    // and is dropped upon exit of fn scope
}

let x = String::from("abc");
f(x); // x loses ownership
x;
    `, "Error: Error: use of moved value x");

test(`
fn f(a: String) {
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
    `, "Error: use of moved value x");