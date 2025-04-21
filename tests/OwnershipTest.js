import { test } from "./TestUtils.js";

export const test_ownership = (visualize_ownership = true) => {

    test(`
let x = String::from("abc");
let y = x; // x loses ownership
x;
    `, "Error: use of moved value x", visualize_ownership);

    test(`
let x = String::from("abc");
let y = x; // x loses ownership
y;
    `, "abc", visualize_ownership);

    test(`
fn f(a: String) { // void return
    // a gains ownership
    // and is dropped upon exit of fn scope
}

let x = String::from("abc");
f(x); // x loses ownership
x;
    `, "Error: use of moved value x", visualize_ownership);

    test(`
fn f(a: String) -> String {
    // a gains ownership
    return a; // returns ownership to caller
}

let x = String::from("abc");
let y = f(x);
y;
    `, "abc", visualize_ownership);

    test(`
let x = String::from("abc");
{
    let y = x;
}
    x;
    `, "Error: use of moved value x", visualize_ownership);

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
    `, "xyz", visualize_ownership);

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
    `, "Error: use of moved value b", visualize_ownership);

    test(`let mut a = String::from("apple");
if true {
    let b = a; // ownership of a moves to b
    a = String::from("orange"); // reassigns ownership of a
}
a; // ownership has been reassigned, so a can still be used
    `, "orange", visualize_ownership);

test(`
let a = String::from("apple");
let b = String::from("banana");

if false {
    let c = a;  // a moved here (even though this branch won't run)
} else {
    let d = b;  // b moved here
}

a;  // Error: use of moved value a
    `, "Error: use of moved value a", visualize_ownership);

}
