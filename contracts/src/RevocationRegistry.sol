// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RevocationRegistry - Sparse Merkle Tree root management for claim revocation
/// @notice Stores the current SMT root. Trusted issuers can revoke claims by updating the root.
/// @dev The actual SMT computation happens off-chain. This contract stores the root commitment.
contract RevocationRegistry {
    bytes32 public revocationRoot;
    address public owner;
    mapping(address => bool) public trustedIssuers;

    event Revoked(bytes32 indexed claimNullifier, bytes32 newRoot);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event RootUpdated(bytes32 oldRoot, bytes32 newRoot);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyTrustedIssuer() {
        require(trustedIssuers[msg.sender], "Not trusted issuer");
        _;
    }

    constructor(bytes32 _initialRoot) {
        owner = msg.sender;
        revocationRoot = _initialRoot;
    }

    /// @notice Add a trusted KYC issuer who can revoke claims
    function addIssuer(address issuer) external onlyOwner {
        trustedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /// @notice Remove a trusted issuer
    function removeIssuer(address issuer) external onlyOwner {
        trustedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// @notice Revoke a claim by updating the SMT root
    /// @param claimNullifier The nullifier of the claim being revoked (Poseidon hash)
    /// @param newRoot The new SMT root after inserting the revocation
    /// @dev The issuer computes the new root off-chain and submits it.
    ///      In production, you'd verify the SMT update proof on-chain.
    ///      For the hackathon, we trust the issuer's computation.
    function revoke(bytes32 claimNullifier, bytes32 newRoot) external onlyTrustedIssuer {
        bytes32 oldRoot = revocationRoot;
        revocationRoot = newRoot;
        emit Revoked(claimNullifier, newRoot);
        emit RootUpdated(oldRoot, newRoot);
    }

    /// @notice Get the current revocation root
    function getRevocationRoot() external view returns (bytes32) {
        return revocationRoot;
    }
}
