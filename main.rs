let mut x = 5; // mutable variable
    {
        let z = & mut x;
        {
            let a = & mut x; // this shld increment mutable_borrow_count for x!
        }
    }
let y = & mut x;

//fn f(a:i32, b:bool) {}
//f(3, true); // works

//fn f(a:i32) {}
//f(true); // fails
