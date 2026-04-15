// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IKycSBT {
    function isHuman(address addr) external view returns (bool);
    function getKycLevel(address addr) external view returns (uint8);
}
