import { test } from "./TestUtils.js";

export const test_code_constructs = () => {

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
while (i < 30) {
let mut j = 0;
while (j < 30) {
    x = x + i + j;
    j = j + 1;
}
i = i + 1;
}
x;
`;
    test(loop2, 26100);

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

}
