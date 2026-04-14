// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../RWAToken.sol";

/// @title StandardRWAToken - Standard ERC-3643 token (no ZK privacy)
/// @notice Identical to RWAToken but uses StandardComplianceModule,
///         which reads identity data from public on-chain mappings.
contract StandardRWAToken is RWAToken {
    constructor(address _compliance)
        RWAToken("Standard Bond", "sBOND", _compliance)
    {}
}
