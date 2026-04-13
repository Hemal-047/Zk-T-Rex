#!/bin/bash
set -e

CIRCUIT_DIR="circuits"
BUILD_DIR="$CIRCUIT_DIR/build"
PTAU_FILE="$BUILD_DIR/pot20_final.ptau"

mkdir -p $BUILD_DIR

echo "=== Step 1: Install circomlib ==="
cd $CIRCUIT_DIR
npm install
cd ..

echo "=== Step 2: Compile circuit ==="
circom $CIRCUIT_DIR/zktrex.circom \
  --r1cs --wasm --sym \
  -o $BUILD_DIR \
  -l $CIRCUIT_DIR/node_modules

echo "=== Step 3: Get Powers of Tau ==="
if [ ! -f "$PTAU_FILE" ]; then
  echo "Downloading powers of tau (this takes a minute)..."
  wget -q -O $PTAU_FILE \
    https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_20.ptau
fi

echo "=== Step 4: Generate proving key ==="
snarkjs groth16 setup \
  $BUILD_DIR/zktrex.r1cs \
  $PTAU_FILE \
  $BUILD_DIR/zktrex_0000.zkey

# Contribute to ceremony (use random entropy for hackathon)
snarkjs zkey contribute \
  $BUILD_DIR/zktrex_0000.zkey \
  $BUILD_DIR/zktrex_final.zkey \
  --name="zktrex hackathon" -v -e="$(head -c 64 /dev/urandom | xxd -p)"

echo "=== Step 5: Export verification key ==="
snarkjs zkey export verificationkey \
  $BUILD_DIR/zktrex_final.zkey \
  $BUILD_DIR/verification_key.json

echo "=== Step 6: Generate Solidity verifier ==="
snarkjs zkey export solidityverifier \
  $BUILD_DIR/zktrex_final.zkey \
  contracts/src/Groth16Verifier.sol

echo "=== Step 7: Print circuit info ==="
snarkjs r1cs info $BUILD_DIR/zktrex.r1cs

echo ""
echo "✅ Circuit compiled. Constraint count printed above."
echo "   Copy build/zktrex_js/zktrex.wasm and build/zktrex_final.zkey to frontend/public/"
