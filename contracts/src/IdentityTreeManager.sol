// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IdentityTreeManager - Manages the Merkle root for the identity registry
/// @notice Shadows the ERC-3643 IdentityRegistry with a Poseidon Merkle commitment
contract IdentityTreeManager {
    bytes32 public identityRoot;
    address public owner;
    uint256 public identityCount;

    event IdentityAdded(bytes32 indexed commitment, uint256 index);
    event RootUpdated(bytes32 oldRoot, bytes32 newRoot);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(bytes32 _initialRoot) {
        owner = msg.sender;
        identityRoot = _initialRoot;
    }

    /// @notice Update the identity tree root after adding/removing identities
    /// @param newRoot New Merkle root after tree modification
    /// @param commitment The identity commitment that was added (for event logging)
    function addIdentity(bytes32 newRoot, bytes32 commitment) external onlyOwner {
        bytes32 oldRoot = identityRoot;
        identityRoot = newRoot;
        identityCount++;
        emit IdentityAdded(commitment, identityCount - 1);
        emit RootUpdated(oldRoot, newRoot);
    }

    /// @notice Update root (for removals or batch updates)
    function updateRoot(bytes32 newRoot) external onlyOwner {
        bytes32 oldRoot = identityRoot;
        identityRoot = newRoot;
        emit RootUpdated(oldRoot, newRoot);
    }

    function getIdentityRoot() external view returns (bytes32) {
        return identityRoot;
    }
}
