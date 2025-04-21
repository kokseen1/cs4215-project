# Dust

Dust is a Rust-inspired language designed for safe systems programming with compile-time ownership, borrowing, and memory management guarantees. The language implements a subset of Rust's memory safety features, including ownership, borrowing, and lifetimes, in a web-based environment. It compiles to a custom virtual machine (DVM) with a focus on ensuring correctness and safety during execution.

## Features

- Ownership and Borrowing: Dust enforces strict ownership rules, ensuring that each resource is owned by one variable at a time and properly deallocated when it goes out of scope.

- Static Analysis: The compiler performs compile-time checks for ownership violations, borrowing conflicts, and lifetime issues.

- Virtual Machine: Dust programs are compiled to bytecode and executed on the Dust Virtual Machine (DVM) with a single ArrayBuffer for memory.

- Source Academy Integration: Dust is integrated with Source Academy, allowing users to write, compile, and run programs in a browser-based interactive environment.

- Ownership DAG Visualization: Dust generates ownership graph visualizations, providing users with a visual representation of ownership flow and resource drops.

## Building Dust

### Prerequisites

Before building Dust, ensure the following tools are installed:

- **Node.js** (v22.14.0)
- **Yarn** (v4.6.0)
- **Rollup** (v4.38.0)

Clone the Dust repository from GitHub:

```bash
git clone https://github.com/kokseen1/dust.git
```

### Building Dust for SourceAcademy

```bash
yarn install
yarn generate_parser
yarn build-conductor
```

The final evaluator will be output to:

```
dist/ConductorCompatibleEvaluator.js
```

### Using in SourceAcademy

To use Dust in the SourceAcademy playground:

1. Open the SourceAcademy playground.

2. Load the `dist/ConductorCompatibleEvaluator.js` file (automatically deployed at https://kokseen1.github.io/dust/ConductorCompatibleEvaluator.js)

3. Interact with Dust programs directly in the SourceAcademy environment.

### Building Dust Locally

```bash
yarn install
yarn generate_parser
yarn build
```


### Example: Running a Dust Program Locally

Create a `main.js` file in the root directory and add the following code:

```js
import { LocalDustEvaluator } from './dist/LocalEvaluator.js';

// Initialize the evaluator
const evaluator = new LocalDustEvaluator();

// Evaluate a Dust program
evaluator.evaluateChunk('let mut x = String::from("hello");', true);
```

Run the program with:

```bash
node main.js
```

You should see the following output:

```
Result of expression: hello
Ownership visualization:
┌───────┐
│"hello"│
└┬──────┘
┌▽┐
│x│
└─┘
```

### Testing Dust

To run all tests, execute the following command in the root directory of the repository:

```bash
node tests/TestAll.js
```
