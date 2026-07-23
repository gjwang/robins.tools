// Shared Standard-JSON solc compile helper used by scripts/compile-*.mjs.
//
// Compiles a single contract source (plus its transitive imports) and writes
// an artifact of the shape: { contractName, solcVersion, optimizer, abi,
// bytecode, standardJsonInput }. Deterministic: no timestamps or other
// non-deterministic data are written, so re-running against unchanged
// sources reproduces an identical file byte-for-byte.

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const solc = require("solc");

const OPTIMIZER = { enabled: true, runs: 200 };

// Emit the ABI, creation bytecode, and the deployed (runtime) bytecode. The
// runtime object is what actually lives on-chain after deployment, so the app
// can verify a resolved address holds the exact expected code.
const OUTPUT_SELECTION = {
  "*": {
    "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
  },
};

/**
 * @param {object} opts
 * @param {string} opts.repoRoot - absolute path to the repo root.
 * @param {string} opts.contractPath - absolute path to the .sol entry file.
 * @param {string} opts.contractSourceKey - source-unit name to register the
 *   entry file under (e.g. "contracts/RobinsToken.sol").
 * @param {string} opts.contractName - the contract name to extract from
 *   solc's output (must match `contract <Name>` in the source).
 * @param {string} opts.outputPath - absolute path to write the artifact to.
 */
export function compileContract({
  repoRoot,
  contractPath,
  contractSourceKey,
  contractName,
  outputPath,
}) {
  const nodeModulesDir = path.join(repoRoot, "node_modules");

  // Every source file actually resolved during compilation (including the
  // entry file), keyed by the same "source unit name" solc uses internally.
  // This is what gets embedded verbatim into standardJsonInput.
  const resolvedSources = {};

  function readSource(sourceKey, absolutePath) {
    const contents = fs.readFileSync(absolutePath, "utf8");
    resolvedSources[sourceKey] = contents;
    return contents;
  }

  /**
   * solc's import callback. Relative imports inside already-resolved files
   * (e.g. "./IERC20.sol" inside "@openzeppelin/contracts/token/ERC20/ERC20.sol")
   * arrive here pre-normalized by solc against the importing file's source
   * unit name, so every import path we see is already an absolute-style
   * specifier. We only need to handle the npm-package prefix.
   */
  function findImports(importPath) {
    try {
      let absolutePath;
      if (importPath.startsWith("@openzeppelin/contracts/")) {
        absolutePath = path.join(nodeModulesDir, importPath);
      } else {
        return { error: `Unresolved import: ${importPath}` };
      }
      const contents = readSource(importPath, absolutePath);
      return { contents };
    } catch {
      return { error: `File not found for import: ${importPath}` };
    }
  }

  const rootSource = readSource(contractSourceKey, contractPath);

  const input = {
    language: "Solidity",
    sources: {
      [contractSourceKey]: { content: rootSource },
    },
    settings: {
      optimizer: OPTIMIZER,
      outputSelection: OUTPUT_SELECTION,
    },
  };

  const outputRaw = solc.compile(JSON.stringify(input), {
    import: findImports,
  });
  const output = JSON.parse(outputRaw);

  const errors = output.errors ?? [];
  const fatalErrors = errors.filter((e) => e.severity === "error");
  const warnings = errors.filter((e) => e.severity !== "error");

  for (const warning of warnings) {
    console.warn(warning.formattedMessage ?? warning.message);
  }

  if (fatalErrors.length > 0) {
    for (const err of fatalErrors) {
      console.error(err.formattedMessage ?? err.message);
    }
    process.exit(1);
  }

  const contractOutput = output.contracts?.[contractSourceKey]?.[contractName];
  if (!contractOutput) {
    console.error(
      `Compilation succeeded but contract ${contractName} was not found in output for ${contractSourceKey}`,
    );
    process.exit(1);
  }

  const bytecodeObject = contractOutput.evm?.bytecode?.object;
  if (!bytecodeObject) {
    console.error("Compilation output is missing evm.bytecode.object");
    process.exit(1);
  }

  const deployedBytecodeObject = contractOutput.evm?.deployedBytecode?.object;
  if (!deployedBytecodeObject) {
    console.error("Compilation output is missing evm.deployedBytecode.object");
    process.exit(1);
  }

  // Build the standard-json input for verification, embedding every source
  // file that was actually pulled in during compilation (the entry file plus
  // every OpenZeppelin file it transitively imports).
  const standardJsonInput = {
    language: "Solidity",
    sources: Object.fromEntries(
      Object.keys(resolvedSources)
        .sort()
        .map((key) => [key, { content: resolvedSources[key] }]),
    ),
    settings: {
      optimizer: OPTIMIZER,
      outputSelection: OUTPUT_SELECTION,
    },
  };

  const artifact = {
    contractName,
    solcVersion: solc.version(),
    optimizer: OPTIMIZER,
    abi: contractOutput.abi,
    bytecode: `0x${bytecodeObject}`,
    deployedBytecode: `0x${deployedBytecodeObject}`,
    standardJsonInput,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
  console.log(`solc ${artifact.solcVersion}`);
  console.log(`bytecode length: ${artifact.bytecode.length} chars`);
  console.log(`sources embedded: ${Object.keys(resolvedSources).length}`);

  return artifact;
}
