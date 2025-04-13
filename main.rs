fn test(mut a: & mut i32) {}

let mut x = 1;
let b = & mut x;
test(& mut x);
