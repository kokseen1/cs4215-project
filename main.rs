let mut x = 5;
{
    let z = & mut x;
    {
        let a = & mut x; // error here
    }
}
let y = & mut x;

/* let mut y = 3;
let mut r = &mut y;
{
    let mut x = 5;
    r = &mut x; // works since x lifetime is not over
} */


