// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/ICompliance.sol";
import "./SimpleIdentityRegistry.sol";

/// @title StandardComplianceModule - Transparent ERC-3643 Compliance
/// @notice Checks the SimpleIdentityRegistry directly — no ZK proofs.
///         Both sender and receiver must be verified (registered + not expired).
contract StandardComplianceModule is ICompliance {
    SimpleIdentityRegistry public identityRegistry;
    address public boundToken;
    address public owner;

    event TransferChecked(address indexed from, address indexed to, bool result);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _identityRegistry) {
        identityRegistry = SimpleIdentityRegistry(_identityRegistry);
        owner = msg.sender;
    }

    function canTransfer(
        address from,
        address to,
        uint256 /* amount */
    ) external view override returns (bool) {
        return identityRegistry.isVerified(from) && identityRegistry.isVerified(to);
    }

    function transferred(address from, address to, uint256 amount) external override {}
    function created(address to, uint256 amount) external override {}
    function destroyed(address from, uint256 amount) external override {}

    function bindToken(address token) external override onlyOwner {
        boundToken = token;
    }

    function unbindToken(address token) external override onlyOwner {
        require(boundToken == token, "Wrong token");
        boundToken = address(0);
    }
}
