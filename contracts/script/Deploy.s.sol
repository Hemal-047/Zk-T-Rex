// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Groth16Verifier.sol";
import "../src/RevocationRegistry.sol";
import "../src/IdentityTreeManager.sol";
import "../src/ZKComplianceModule.sol";
import "../src/RWAToken.sol";
import "../src/demo/SimpleIdentityRegistry.sol";
import "../src/demo/StandardComplianceModule.sol";
import "../src/demo/StandardRWAToken.sol";

contract DeployZKTRex is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Groth16 Verifier (auto-generated)
        Groth16Verifier verifier = new Groth16Verifier();
        console.log("Groth16Verifier:", address(verifier));

        // 2. Deploy Revocation Registry with empty Poseidon SMT root (height 20)
        // Computed by: scripts/compute-roots.js
        bytes32 emptyRevocationRoot = 0x2d3c07bea6883428edd2d80d07cec4b911309fed96743822d6aadea06313a951;
        RevocationRegistry revocation = new RevocationRegistry(emptyRevocationRoot);
        console.log("RevocationRegistry:", address(revocation));

        // 3. Deploy Identity Tree Manager with empty Poseidon Merkle root (height 20)
        // Computed by: scripts/compute-roots.js
        bytes32 emptyIdentityRoot = 0x2d3c07bea6883428edd2d80d07cec4b911309fed96743822d6aadea06313a951;
        IdentityTreeManager identity = new IdentityTreeManager(emptyIdentityRoot);
        console.log("IdentityTreeManager:", address(identity));

        // 4. Deploy ZK Compliance Module
        ZKComplianceModule compliance = new ZKComplianceModule(
            address(verifier),
            address(revocation),
            address(identity)
        );
        console.log("ZKComplianceModule:", address(compliance));

        // 5. Deploy RWA Token
        RWAToken token = new RWAToken(
            "HashKey Tokenized Bond",
            "hkBOND",
            address(compliance)
        );
        console.log("RWAToken:", address(token));

        // 6. Bind token to compliance module
        compliance.bindToken(address(token));

        // 7. Add deployer as trusted issuer on RevocationRegistry
        revocation.addIssuer(vm.addr(deployerPrivateKey));

        // 8. Mint initial supply to deployer for demo
        token.mint(vm.addr(deployerPrivateKey), 1_000_000 * 1e18);

        // ============================================================
        // Standard ERC-3643 Contracts (transparent — for comparison demo)
        // ============================================================
        console.log("");
        console.log("=== Deploying Standard ERC-3643 (transparent) ===");

        // 9. Deploy SimpleIdentityRegistry
        SimpleIdentityRegistry identityRegistry = new SimpleIdentityRegistry();
        console.log("SimpleIdentityRegistry:", address(identityRegistry));

        // 10. Deploy StandardComplianceModule
        StandardComplianceModule stdCompliance = new StandardComplianceModule(
            address(identityRegistry)
        );
        console.log("StandardComplianceModule:", address(stdCompliance));

        // 11. Deploy StandardRWAToken
        StandardRWAToken stdToken = new StandardRWAToken(address(stdCompliance));
        console.log("StandardRWAToken:", address(stdToken));

        // 12. Bind token to compliance
        stdCompliance.bindToken(address(stdToken));

        // 13. Register Alice — HK investor, KYC Level 2, accredited
        address alice = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        identityRegistry.registerIdentity(
            alice,
            2,      // kycLevel
            852,    // jurisdiction (Hong Kong)
            true,   // isAccredited
            block.timestamp + 365 days
        );
        console.log("Alice registered:", alice);

        // 14. Register Bob — SG investor, KYC Level 1, accredited
        address bob = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        identityRegistry.registerIdentity(
            bob,
            1,      // kycLevel
            65,     // jurisdiction (Singapore)
            true,   // isAccredited
            block.timestamp + 365 days
        );
        console.log("Bob registered:", bob);

        // 15. Mint tokens to Alice for demo transfers
        stdToken.mint(alice, 100_000 * 1e18);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Chain: HashKey Testnet (133)");
        console.log("Explorer: https://testnet-explorer.hsk.xyz");
    }
}
