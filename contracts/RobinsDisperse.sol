// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title RobinsDisperse
/// @notice Minimal, audit-friendly batch sender for native ETH and ERC-20 tokens.
/// No constructor args, no owner, no receive/fallback. Tokens are pulled directly
/// from the caller to each recipient in the same transaction and never rest in
/// this contract (no pooling) — a deliberate safety property.
contract RobinsDisperse {
    using SafeERC20 for IERC20;

    /// @notice Thrown when `recipients` and `values` have different lengths.
    error LengthMismatch();

    /// @notice Thrown when a native ETH transfer to `recipient` fails.
    error EtherTransferFailed(address recipient);

    /// @notice Sends `values[i]` wei to `recipients[i]` for each i, then refunds
    /// any leftover `msg.value` back to the caller.
    function disperseEther(address[] calldata recipients, uint256[] calldata values) external payable {
        if (recipients.length != values.length) revert LengthMismatch();

        for (uint256 i = 0; i < recipients.length; i++) {
            (bool success, ) = recipients[i].call{value: values[i]}("");
            if (!success) revert EtherTransferFailed(recipients[i]);
        }

        uint256 remaining = address(this).balance;
        if (remaining > 0) {
            (bool success, ) = msg.sender.call{value: remaining}("");
            if (!success) revert EtherTransferFailed(msg.sender);
        }
    }

    /// @notice Transfers `values[i]` of `token` from the caller to `recipients[i]`
    /// for each i, via `safeTransferFrom`. Requires the caller to have approved
    /// this contract for at least the sum of `values` beforehand.
    function disperseToken(IERC20 token, address[] calldata recipients, uint256[] calldata values) external {
        if (recipients.length != values.length) revert LengthMismatch();

        for (uint256 i = 0; i < recipients.length; i++) {
            token.safeTransferFrom(msg.sender, recipients[i], values[i]);
        }
    }
}
