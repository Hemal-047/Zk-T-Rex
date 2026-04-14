// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RevocationRegistry.sol";
import "../src/IdentityTreeManager.sol";
import "../src/ZKComplianceModule.sol";
import "../src/RWAToken.sol";

contract ZKComplianceTest is Test {
    RevocationRegistry revocation;
    IdentityTreeManager identity;
    ZKComplianceModule compliance;
    RWAToken token;
    address mockVerifier;

    address alice = address(0x1);
    address bob = address(0x2);
    address issuer = address(0x3);

    function setUp() public {
        // Warp to a realistic timestamp so lastProofTimestamp checks work
        vm.warp(1700000000);

        // Deploy mock verifier that always returns true (for unit tests)
        mockVerifier = address(new MockVerifier());

        revocation = new RevocationRegistry(bytes32(uint256(1)));
        identity = new IdentityTreeManager(bytes32(uint256(2)));
        compliance = new ZKComplianceModule(
            mockVerifier,
            address(revocation),
            address(identity)
        );
        token = new RWAToken("Test Bond", "tBOND", address(compliance));
        compliance.bindToken(address(token));

        // Setup issuer
        revocation.addIssuer(issuer);

        // Mint tokens to alice
        token.mint(alice, 1000 * 1e18);
    }

    function testCannotTransferWithoutProof() public {
        vm.prank(alice);
        vm.expectRevert("Transfer not compliant");
        token.transfer(bob, 100 * 1e18);
    }

    function testCanTransferAfterBothPartiesProve() public {
        // Simulate proof submission (mock verifier accepts all)
        _submitMockProof(alice);
        _submitMockProof(bob);

        vm.prank(alice);
        token.transfer(bob, 100 * 1e18);

        assertEq(token.balanceOf(bob), 100 * 1e18);
    }

    function testProofExpiresAfterFreshnessWindow() public {
        _submitMockProof(alice);
        _submitMockProof(bob);

        // Warp past freshness window
        vm.warp(block.timestamp + 2 hours);

        vm.prank(alice);
        vm.expectRevert("Transfer not compliant");
        token.transfer(bob, 100 * 1e18);
    }

    function testFreezeAddress() public {
        _submitMockProof(alice);
        _submitMockProof(bob);

        token.freezeAddress(alice, true);

        vm.prank(alice);
        vm.expectRevert("Sender frozen");
        token.transfer(bob, 100 * 1e18);
    }

    function testRevocationUpdatesRoot() public {
        bytes32 newRoot = bytes32(uint256(99));
        vm.prank(issuer);
        revocation.revoke(bytes32(uint256(42)), newRoot);

        assertEq(revocation.revocationRoot(), newRoot);
    }

    function testOnlyIssuerCanRevoke() public {
        vm.prank(alice);
        vm.expectRevert("Not trusted issuer");
        revocation.revoke(bytes32(uint256(42)), bytes32(uint256(99)));
    }

    function testOnlyOwnerCanAddIssuer() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        revocation.addIssuer(alice);
    }

    function _submitMockProof(address user) internal {
        uint256[2] memory a = [uint256(0), uint256(0)];
        uint256[2][2] memory b = [[uint256(0), uint256(0)], [uint256(0), uint256(0)]];
        uint256[2] memory c = [uint256(0), uint256(0)];
        uint256[] memory signals = new uint256[](7);
        signals[0] = 1; // valid
        signals[1] = uint256(identity.getIdentityRoot());
        signals[2] = uint256(revocation.getRevocationRoot());
        signals[3] = block.timestamp;

        vm.prank(user);
        compliance.submitProof(a, b, c, signals);
    }
}

/// @notice Mock verifier that always returns true (for unit testing)
contract MockVerifier {
    fallback() external {
        assembly {
            mstore(0, 1)
            return(0, 32)
        }
    }
}
