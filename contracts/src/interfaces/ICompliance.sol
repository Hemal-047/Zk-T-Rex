// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICompliance - ERC-3643 Compliance Module Interface
/// @notice Simplified interface matching the T-REX compliance hook
interface ICompliance {
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);

    function transferred(
        address from,
        address to,
        uint256 amount
    ) external;

    function created(address to, uint256 amount) external;
    function destroyed(address from, uint256 amount) external;
    function bindToken(address token) external;
    function unbindToken(address token) external;
}
