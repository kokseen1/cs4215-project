import { test } from "./TestUtils.js";

export const test_lifetimes_with_blocks = () => {

    test(`
let mut y = 3;
let mut r = &mut y;
{
    let mut x = 5;
    r = &mut x;
}
*r; // error since lifetime of x ended
`, `Error: unbound name: x`);

    test(`
let mut y = 3;
let mut r = &mut y;
{
    let mut x = 5;
    r = &mut x; // works since x lifetime is not over
}
`, 5);

}

