fn g(b: String) -> String {
    // b gains ownership from caller
    let c = String::from("xyz");
    return c; // pass ownership of c to caller
} // b is dropped

fn f(a: String) -> String {
    // a gains ownership from caller
    let b = g(a); // b gains ownership
    return b; // pass ownership of b to caller
} // a is dropped

let x = String::from("abc");
let mut y = String::from("freeme");
y = f(x); // reassignment: old value of y ("freeme") is freed, y now owns "xyz"
display(y);
