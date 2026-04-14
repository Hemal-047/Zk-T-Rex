// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/ICompliance.sol";

/// @title RWAToken - Simplified ERC-3643 compliant RWA token
/// @notice Implements transfer restrictions via a pluggable compliance module
/// @dev Simplified from full T-REX for hackathon scope. Demonstrates the compliance hook pattern.
contract RWAToken is ERC20 {
    ICompliance public compliance;
    address public owner;
    address public agent; // Authorized minter/burner

    mapping(address => bool) public frozen;

    event ComplianceUpdated(address indexed oldCompliance, address indexed newCompliance);
    event AddressFrozen(address indexed user, bool isFrozen);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent || msg.sender == owner, "Not agent");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _compliance
    ) ERC20(name, symbol) {
        owner = msg.sender;
        agent = msg.sender;
        compliance = ICompliance(_compliance);
    }

    /// @notice Override transfer to enforce compliance
    function transfer(address to, uint256 amount) public override returns (bool) {
        require(!frozen[msg.sender], "Sender frozen");
        require(!frozen[to], "Receiver frozen");
        require(
            compliance.canTransfer(msg.sender, to, amount),
            "Transfer not compliant"
        );
        bool success = super.transfer(to, amount);
        if (success) {
            compliance.transferred(msg.sender, to, amount);
        }
        return success;
    }

    /// @notice Override transferFrom to enforce compliance
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(!frozen[from], "Sender frozen");
        require(!frozen[to], "Receiver frozen");
        require(
            compliance.canTransfer(from, to, amount),
            "Transfer not compliant"
        );
        bool success = super.transferFrom(from, to, amount);
        if (success) {
            compliance.transferred(from, to, amount);
        }
        return success;
    }

    // === Admin functions ===

    function mint(address to, uint256 amount) external onlyAgent {
        _mint(to, amount);
        compliance.created(to, amount);
    }

    function burn(address from, uint256 amount) external onlyAgent {
        _burn(from, amount);
        compliance.destroyed(from, amount);
    }

    function setCompliance(address _compliance) external onlyOwner {
        address old = address(compliance);
        compliance = ICompliance(_compliance);
        emit ComplianceUpdated(old, _compliance);
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    function freezeAddress(address user, bool freeze) external onlyAgent {
        frozen[user] = freeze;
        emit AddressFrozen(user, freeze);
    }
}
