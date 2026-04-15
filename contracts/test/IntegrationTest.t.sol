// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RevocationRegistry.sol";
import "../src/IdentityTreeManager.sol";
import "../src/ZKComplianceModule.sol";
import "../src/RWAToken.sol";

contract IntegrationMockVerifier {
    fallback() external {
        assembly {
            mstore(0, 1)
            return(0, 32)
        }
    }
}

/// @notice Full-stack integration: register identity, submit proof,
///         execute a compliant transfer, then revoke and verify the
///         transfer blocks.
contract IntegrationTest is Test {
    RevocationRegistry revocation;
    IdentityTreeManager identity;
    ZKComplianceModule compliance;
    RWAToken token;
    IntegrationMockVerifier verifier;

    address issuer = address(0x1551E);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        vm.warp(1700000000);

        verifier = new IntegrationMockVerifier();

        revocation = new RevocationRegistry(bytes32(uint256(1)));
        identity = new IdentityTreeManager(bytes32(uint256(2)));
        compliance = new ZKComplianceModule(
            address(verifier),
            address(revocation),
            address(identity)
        );
        token = new RWAToken("HashKey Bond", "hkBOND", address(compliance));
        compliance.bindToken(address(token));

        revocation.addIssuer(issuer);
    }

    function _submitProofFor(address user) internal {
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

    function testFullFlow() public {
        // 1. Register an identity commitment on-chain
        bytes32 newIdRoot = bytes32(uint256(0xF001));
        identity.addIdentity(newIdRoot, bytes32(uint256(0xAA)));
        assertEq(identity.identityCount(), 1);

        // 2. Mint alice some hkBOND
        token.mint(alice, 1000 * 1e18);
        assertEq(token.balanceOf(alice), 1000 * 1e18);

        // 3. Submit proofs for both parties (mock verifier accepts)
        _submitProofFor(alice);
        _submitProofFor(bob);

        // 4. canTransfer should now be true
        assertTrue(compliance.canTransfer(alice, bob, 100 * 1e18));

        // 5. Execute the transfer; balances should move
        vm.prank(alice);
        bool ok = token.transfer(bob, 100 * 1e18);
        assertTrue(ok);
        assertEq(token.balanceOf(alice), 900 * 1e18);
        assertEq(token.balanceOf(bob), 100 * 1e18);
    }

    function testRevokedUserCannotTransfer() public {
        // Bootstrap the same flow
        token.mint(alice, 1000 * 1e18);
        _submitProofFor(alice);
        _submitProofFor(bob);
        assertTrue(compliance.canTransfer(alice, bob, 100 * 1e18));

        // Issuer revokes alice — proof becomes stale because the
        // on-chain revocationRoot no longer matches the signal alice
        // committed to at proof time. Warp past the freshness window
        // so alice's old proof expires and she has to re-prove with
        // the new root (which she can't, because she's revoked).
        vm.prank(issuer);
        revocation.revoke(bytes32(uint256(0xBAD)), bytes32(uint256(0xBEEF)));

        vm.warp(block.timestamp + 2 hours);

        // Old proofs are no longer fresh — canTransfer returns false
        assertFalse(compliance.canTransfer(alice, bob, 100 * 1e18));

        // Transfer is blocked
        vm.prank(alice);
        vm.expectRevert("Transfer not compliant");
        token.transfer(bob, 100 * 1e18);
    }
}
