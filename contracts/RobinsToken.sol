// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title RobinsToken
/// @notice Minimal, audit-friendly ERC-20 with optional mint/burn toggles, deployed
/// from the robins.tools Token Creator. No pausing, no upgradeability, no fees.
contract RobinsToken is ERC20, Ownable {
    /// @notice Thrown when `mint` is called but minting was disabled at deployment.
    error NotMintable();

    /// @notice Thrown when `burn`/`burnFrom` is called but burning was disabled at deployment.
    error NotBurnable();

    uint8 private immutable _decimals;

    /// @notice Whether `mint` can be called by the owner.
    bool public immutable mintable;

    /// @notice Whether `burn`/`burnFrom` can be called.
    bool public immutable burnable;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        bool mintable_,
        bool burnable_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        _decimals = decimals_;
        mintable = mintable_;
        burnable = burnable_;

        if (initialSupply_ > 0) {
            _mint(owner_, initialSupply_);
        }
    }

    /// @inheritdoc ERC20
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Mints `amount` tokens to `to`. Only callable by the owner, and only
    /// when minting was enabled at deployment.
    function mint(address to, uint256 amount) external onlyOwner {
        if (!mintable) revert NotMintable();
        _mint(to, amount);
    }

    /// @notice Burns `amount` tokens from the caller's balance.
    function burn(uint256 amount) external {
        if (!burnable) revert NotBurnable();
        _burn(_msgSender(), amount);
    }

    /// @notice Burns `amount` tokens from `account`, deducting the allowance the
    /// caller was granted by `account`. Mirrors OZ's ERC20Burnable.burnFrom.
    function burnFrom(address account, uint256 amount) external {
        if (!burnable) revert NotBurnable();
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }
}
