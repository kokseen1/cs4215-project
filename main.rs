// both mutable and immutable borrow
fn test(mut a: & mut i32) {}

let x = 1;
test(& mut x);
test(& mut x);
