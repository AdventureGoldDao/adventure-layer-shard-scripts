#!/bin/bash

# ------------- #
# Configuration #
# ------------- #

# Load variables from .env file
set -o allexport
source scripts/.env
set +o allexport

if [ -z "$CONTRACT_PATH" ]
then
    echo "$CONTRACT_PATH is not set. Set them in the .env file"
    exit 0
fi

cd "$CONTRACT_PATH" || exit

# Helper constants
DEPLOY_CONTRACT_RESULT_FILE=create_contract_result


# -------------- #
# Initial checks #
# -------------- #
if [ -z "$RPC_URL" ] || [ -z "$PRIVATE_KEY" ]
then
    echo "You need to provide the RPC_URL and the PRIVATE_KEY of the deployer"
    exit 0
fi

if [ -z "$PROXY_CONTRACT_ADDRESS" ] || [ -z "$PROXY_ADMIN_ADDRESS" ]
then
    echo "PROXY_CONTRACT_ADDRESS or PROXY_ADMIN_ADDRESS are not set"
    echo "You can run the script by setting the variables at the beginning: PROXY_CONTRACT_ADDRESS=0x PROXY_ADMIN_ADDRESS=0x updateLogic.sh"
    exit 0
fi

# ------------------'------------------ #
# Deployment of new Rust $CONTRACT_PATH #
# -----------------'------------------- #
echo ""
echo "------------'----------------------"
echo "Deploying new Rust $CONTRACT_PATH contract"
echo "-----------'-----------------------"

# Prepare transactions data
cargo stylus deploy -e $RPC_URL --private-key $PRIVATE_KEY > $DEPLOY_CONTRACT_RESULT_FILE

contract_address=$(cat $DEPLOY_CONTRACT_RESULT_FILE | grep "deployed code at address:" | awk -F' ' '{print $5}')
rm $DEPLOY_CONTRACT_RESULT_FILE

# Final result
echo "$CONTRACT_PATH contract deployed and activated at address: $contract_address"

# -------------------------------- #
# Updating logic contract on proxy #
# -------------------------------- #
echo ""
echo "--------------------------------"
echo "Updating logic contract on proxy"
echo "--------------------------------"

cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $PROXY_ADMIN_ADDRESS "upgradeAndCall(address,address,bytes)()" $PROXY_CONTRACT_ADDRESS $contract_address 0x

echo "Proxy $PROXY_CONTRACT_ADDRESS was updated to implementation in $contract_address"

# PROXY_CONTRACT_ADDRESS= PROXY_ADMIN_ADDRESS= ./scripts/updateLogic.sh
