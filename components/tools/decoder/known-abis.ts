import { type Abi, type AbiEvent, erc20Abi, parseAbi } from "viem";

/**
 * Rung 2 of the ABI ladder: well-known function signatures decoded locally with
 * no network access. viem's `erc20Abi` covers ERC-20 (transfer/approve/…); these
 * add the common ERC-721 / ERC-1155 transfer and approval entrypoints.
 */
const tokenFunctionAbi = parseAbi([
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
  "function setApprovalForAll(address operator, bool approved)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
  "function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)",
]);

export const localFunctionAbi: Abi = [...erc20Abi, ...tokenFunctionAbi];

/**
 * Known event signatures for log decoding. Both ERC-20 and ERC-721 `Transfer` /
 * `Approval` share a topic0 but differ in how many arguments are indexed, so both
 * variants are listed; the decoder picks the one whose indexed count matches the
 * log's topics.
 */
export const knownEventAbi: readonly AbiEvent[] = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
]);
