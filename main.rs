let mut x = 5;
{
    let z = & mut x;
    {
        let a = & mut x; // error here
    }
}
let y = & mut x;

//fn f(a:i32, b:bool) {}
//f(3, true); // works

//fn f(a:i32) {}
//f(true); // fails

//enter_scope: rmb
//exit_scope: forget
//every blk do a deep copy?