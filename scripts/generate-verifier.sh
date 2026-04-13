#!/bin/bash
set -e

BUILD_DIR="circuits/build"

echo "=== Generating Solidity verifier ==="
snarkjs zkey export solidityverifier \
  $BUILD_DIR/zktrex_final.zkey \
  contracts/src/Groth16Verifier.sol

echo "✅ Groth16Verifier.sol generated in contracts/src/"
