// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RevocationRegistry.sol";
import "../src/IdentityTreeManager.sol";
import "../src/ZKComplianceModule.sol";
import "../src/RWAToken.sol";

/// @notice MockVerifier that always returns true — matches pattern in ZKCompliance.t.sol.
contract MockVerifier {
    fallback() external {
        assembly {
            mstore(0, 1)
            return(0, 32)
        }
    }
}

contract RWATokenTest is Test {
    RevocationRegistry revocation;
    IdentityTreeManager identity;
    ZKComplianceModule compliance;
    RWAToken token;
    address mockVerifier;

    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA401);

    function setUp() public {
        vm.warp(1700000000);
        mockVerifier = address(new MockVerifier());

        revocation = new RevocationRegistry(bytes32(uint256(1)));
        identity = new IdentityTreeManager(bytes32(uint256(2)));
        compliance = new ZKComplianceModule(
            mockVerifier,
            address(revocation),
            address(identity)
        );
        token = new RWAToken("HashKey Bond", "hkBOND", address(compliance));
        compliance.bindToken(address(token));
    }

    function _submitMockProof(address user) internal {
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [
            [uint256(0), uint256(0)],
            [uint256(0), uint256(0)]
        ];
        uint256[2] memory c = [uint256(0), uint256(0)];
        uint256[] memory signals = new uint256[](7);
        signals[0] = 1;
        signals[1] = uint256(identity.getIdentityRoot());
        signals[2] = uint256(revocation.getRevocationRoot());
        signals[3] = block.timestamp;

        vm.prank(user);
        compliance.submitProof(a, b, c, signals);
    }

    // === Minting ===

    function testMintByAgent() public {
        token.mint(alice, 500 * 1e18);
        assertEq(token.balanceOf(alice), 500 * 1e18);
    }

    function testMintByNonAgentReverts() public {
        vm.prank(alice);
        vm.expectRevert("Not agent");
        token.mint(alice, 500 * 1e18);
    }

    // === Compliance-gated transfers ===

    function testTransferBlockedWithoutCompliance() public {
        token.mint(alice, 500 * 1e18);

        vm.prank(alice);
        vm.expectRevert("Transfer not compliant");
        token.transfer(bob, 100 * 1e18);
    }

    function testTransferBlockedWhenReceiverNonCompliant() public {
        token.mint(alice, 500 * 1e18);
        // Only alice submits a proof — bob is non-compliant
        _submitMockProof(alice);

        vm.prank(alice);
        vm.expectRevert("Transfer not compliant");
        token.transfer(bob, 100 * 1e18);
    }

    // === Freeze semantics ===

    function testFreezeBlocksTransfer() public {
        token.mint(alice, 500 * 1e18);
        _submitMockProof(alice);
        _submitMockProof(bob);

        token.freezeAddress(alice, true);

        vm.prank(alice);
        vm.expectRevert("Sender frozen");
        token.transfer(bob, 100 * 1e18);
    }

    function testFreezeBlocksReceive() public {
        token.mint(alice, 500 * 1e18);
        _submitMockProof(alice);
        _submitMockProof(bob);

        token.freezeAddress(bob, true);

        vm.prank(alice);
        vm.expectRevert("Receiver frozen");
        token.transfer(bob, 100 * 1e18);
    }

    function testUnfreezeAllowsTransfer() public {
        token.mint(alice, 500 * 1e18);
        _submitMockProof(alice);
        _submitMockProof(bob);

        token.freezeAddress(alice, true);
        token.freezeAddress(alice, false);

        vm.prank(alice);
        bool ok = token.transfer(bob, 100 * 1e18);
        assertTrue(ok);
        assertEq(token.balanceOf(bob), 100 * 1e18);
    }

    // === Burn ===

    function testBurnByAgent() public {
        token.mint(alice, 500 * 1e18);
        token.burn(alice, 200 * 1e18);
        assertEq(token.balanceOf(alice), 300 * 1e18);
    }
}
