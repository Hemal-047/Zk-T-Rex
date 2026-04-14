// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Groth16Verifier.sol";
import "../src/RevocationRegistry.sol";
import "../src/IdentityTreeManager.sol";
import "../src/ZKComplianceModule.sol";
import "../src/RWAToken.sol";

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

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Chain: HashKey Testnet (133)");
        console.log("Explorer: https://testnet-explorer.hsk.xyz");
    }
}
