#!/usr/bin/env node
// Compiles contracts/RobinsToken.sol with solc via Standard-JSON and writes the
// resulting ABI/bytecode/verification input to lib/abis/robins-token.json.
// See scripts/lib/solc-compile.mjs for the shared compile/write logic.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileContract } from "./lib/solc-compile.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

compileContract({
  repoRoot,
  contractPath: path.join(repoRoot, "contracts", "RobinsToken.sol"),
  contractSourceKey: "contracts/RobinsToken.sol",
  contractName: "RobinsToken",
  outputPath: path.join(repoRoot, "lib", "abis", "robins-token.json"),
});
