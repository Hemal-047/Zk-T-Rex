// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RevocationRegistry.sol";

contract RevocationRegistryTest is Test {
    RevocationRegistry registry;

    address owner = address(this);
    address issuer = address(0x1551E);
    address alice = address(0xA11CE);

    bytes32 constant INITIAL_ROOT = bytes32(uint256(1));

    event Revoked(bytes32 indexed claimNullifier, bytes32 newRoot);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    function setUp() public {
        registry = new RevocationRegistry(INITIAL_ROOT);
    }

    function testAddIssuer() public {
        registry.addIssuer(issuer);
        assertTrue(registry.trustedIssuers(issuer));
    }

    function testRemoveIssuer() public {
        registry.addIssuer(issuer);
        registry.removeIssuer(issuer);
        assertFalse(registry.trustedIssuers(issuer));
    }

    function testOnlyIssuerCanRevoke() public {
        vm.prank(alice);
        vm.expectRevert("Not trusted issuer");
        registry.revoke(bytes32(uint256(42)), bytes32(uint256(99)));
    }

    function testOnlyOwnerCanAddIssuer() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        registry.addIssuer(alice);
    }

    function testRevokeUpdatesRoot() public {
        registry.addIssuer(issuer);
        bytes32 newRoot = bytes32(uint256(0xDEADBEEF));

        vm.prank(issuer);
        registry.revoke(bytes32(uint256(42)), newRoot);

        assertEq(registry.revocationRoot(), newRoot);
    }

    function testRevokeEmitsEvent() public {
        registry.addIssuer(issuer);
        bytes32 nullifier = bytes32(uint256(42));
        bytes32 newRoot = bytes32(uint256(0xDEADBEEF));

        vm.expectEmit(true, false, false, true);
        emit Revoked(nullifier, newRoot);

        vm.prank(issuer);
        registry.revoke(nullifier, newRoot);
    }
}
