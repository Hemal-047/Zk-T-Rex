// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/IdentityTreeManager.sol";

contract IdentityTreeManagerTest is Test {
    IdentityTreeManager manager;
    address alice = address(0xA11CE);

    bytes32 constant INITIAL_ROOT = bytes32(uint256(2));

    function setUp() public {
        manager = new IdentityTreeManager(INITIAL_ROOT);
    }

    function testAddIdentityUpdatesRoot() public {
        bytes32 newRoot = bytes32(uint256(0xFEEDFACE));
        bytes32 commitment = bytes32(uint256(0xABCDEF));

        manager.addIdentity(newRoot, commitment);

        assertEq(manager.getIdentityRoot(), newRoot);
    }

    function testAddIdentityIncrementsCount() public {
        uint256 before = manager.identityCount();
        manager.addIdentity(bytes32(uint256(10)), bytes32(uint256(1)));
        manager.addIdentity(bytes32(uint256(11)), bytes32(uint256(2)));
        assertEq(manager.identityCount(), before + 2);
    }

    function testOnlyOwnerCanAddIdentity() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        manager.addIdentity(bytes32(uint256(10)), bytes32(uint256(1)));
    }

    function testUpdateRootByOwner() public {
        bytes32 newRoot = bytes32(uint256(0xCAFEBABE));
        manager.updateRoot(newRoot);
        assertEq(manager.getIdentityRoot(), newRoot);
    }
}
