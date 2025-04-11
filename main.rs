fn test(a: & mut i32) { // MISMATCHED TYPES
    //*a = 5;
}

let x = 7;
test(& x);

//fn f(a:i32) {}
//f(true); // fails
