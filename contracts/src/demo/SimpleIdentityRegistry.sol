// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SimpleIdentityRegistry - Transparent ERC-3643 Identity Storage
/// @notice Stores KYC/identity data in PUBLIC mappings — demonstrates the privacy
///         problem that zkT-REX solves. Anyone can query any investor's jurisdiction,
///         KYC level, accreditation status, and claim expiry.
contract SimpleIdentityRegistry {
    mapping(address => bool) public registered;
    mapping(address => uint8) public kycLevel;
    mapping(address => uint16) public jurisdiction;
    mapping(address => bool) public isAccredited;
    mapping(address => uint256) public kycExpiry;

    address public owner;

    event IdentityRegistered(address indexed user, uint16 jurisdiction, uint8 kycLevel);
    event IdentityRemoved(address indexed user);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerIdentity(
        address user,
        uint8 _kycLevel,
        uint16 _jurisdiction,
        bool _isAccredited,
        uint256 _kycExpiry
    ) external onlyOwner {
        registered[user] = true;
        kycLevel[user] = _kycLevel;
        jurisdiction[user] = _jurisdiction;
        isAccredited[user] = _isAccredited;
        kycExpiry[user] = _kycExpiry;
        emit IdentityRegistered(user, _jurisdiction, _kycLevel);
    }

    function removeIdentity(address user) external onlyOwner {
        registered[user] = false;
        emit IdentityRemoved(user);
    }

    function isVerified(address user) external view returns (bool) {
        return registered[user] && block.timestamp < kycExpiry[user];
    }
}
