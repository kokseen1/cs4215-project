import { test_borrowing, test_borrowing_with_blocks, test_borrowing_with_functions } from "./BorrowingTest.js"
import { test_code_constructs } from "./CodeConstructsTest.js"
import { test_lifetimes_with_blocks } from "./LifetimeTest.js"
import { test_mutability } from "./MutabilityTest.js"
import { test_ownership } from "./OwnershipTest.js"
import { test_type_mismatch } from "./TypeMismatchTest.js"

// test assignments, declarations, conditionals, loops etc
test_code_constructs();
test_type_mismatch();
test_mutability();
test_borrowing();
test_borrowing_with_blocks();
test_borrowing_with_functions();
test_lifetimes_with_blocks();
test_ownership();
