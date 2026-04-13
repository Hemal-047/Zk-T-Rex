#!/bin/bash
set -e

echo "=== zkT-REX Deployment ==="

# Load environment
if [ -f .env ]; then
  source .env
else
  echo "ERROR: .env file not found. Create one with PRIVATE_KEY=0x..."
  exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "ERROR: PRIVATE_KEY not set in .env"
  exit 1
fi

echo "=== Deploying to HashKey Chain Testnet (Chain ID: 133) ==="

cd contracts

forge script script/Deploy.s.sol:DeployZKTRex \
  --rpc-url https://testnet.hsk.xyz \
  --broadcast \
  --verify

echo ""
echo "=== Deployment Complete ==="
echo "Check https://testnet-explorer.hsk.xyz for contract addresses"
