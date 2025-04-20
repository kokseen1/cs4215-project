let mut y = 3;
let mut r = &mut y;
{
    let mut x = 5;
    r = &mut x; // works since x lifetime is not over
}


