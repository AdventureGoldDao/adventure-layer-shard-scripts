#!/bin/bash

# Load variables from .env file
set -o allexport
source scripts/.env
set +o allexport


# -------------- #
# Initial checks #
# -------------- #
if [ -z "$RECEIVER_ADDRESS" ] || [ -z "$RECEIVER_PRIVATE_KEY" ]
then
    echo "RECEIVER_ADDRESS or RECEIVER_PRIVATE_KEY is not set. Set them in the .env file"
    exit 0
fi

if [ -z "$CONTRACT_ADDRESS" ]
then
    echo "CONTRACT_ADDRESS is not set"
    echo "You can run the script by setting the variables at the beginning: CONTRACT_ADDRESS=0x test.sh"
    exit 0
fi

echo "Testing contract deployed at $CONTRACT_ADDRESS"

# Initial balances
initial_balance=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "Initial balance of $ADDRESS: $initial_balance"
initial_receiver_balance=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $RECEIVER_ADDRESS)
echo "Initial balance of $RECEIVER_ADDRESS: $initial_receiver_balance"

# Initial supply
initial_total_supply=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "totalSupply() (uint256)")
first_token_to_mint=$initial_total_supply
echo "Initial supply: $initial_total_supply"


# -----------------
# Token information
# -----------------
echo ""
echo "*****************"
echo "Token information"
echo "*****************"
token_name=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "name() (string)")
token_symbol=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "symbol() (string)")
supports_interface_721=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "supportsInterface(bytes4) (bool)" 0x80ac58cd)
supports_interface_721_metadata=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "supportsInterface(bytes4) (bool)" 0x5b5e139f)
supports_interface_165=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "supportsInterface(bytes4) (bool)" 0x01ffc9a7)
supports_random_interface=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "supportsInterface(bytes4) (bool)" 0x12345678)

echo "Name: $token_name"
echo "Symbol: $token_symbol"
echo "Supports interface ERC-721 (0x80ac58cd): $supports_interface_721"
echo "Supports interface ERC-721 Metadata (0x5b5e139f): $supports_interface_721_metadata"
echo "Supports interface ERC-165 (0x01ffc9a7): $supports_interface_165"
echo "Supports random interface (should be false): $supports_random_interface"


# ------------
# Minting test
# ------------
echo ""
echo "************"
echo "Minting test"
echo "************"

echo "Minting 3 NFTs"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "mint() ()"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "mint() ()"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "mint() ()"

echo "Minting 2 NFT to $RECEIVER_ADDRESS"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "mintTo(address) ()" $RECEIVER_ADDRESS
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "mintTo(address) ()" $RECEIVER_ADDRESS

# Check balances
balance_after_mint=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "New balance of $ADDRESS: $balance_after_mint"
expected_balance=$((initial_balance + 3))
if [ "$balance_after_mint" -ne "$expected_balance" ]; then
    echo "New balance ($balance_after_mint) is not the expected balance ($expected_balance)"
    exit 1
fi

receiver_balance_after_mint=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $RECEIVER_ADDRESS)
echo "New balance of $RECEIVER_ADDRESS: $receiver_balance_after_mint"
expected_receiver_balance=$((initial_receiver_balance + 2))
if [ "$receiver_balance_after_mint" -ne "$expected_receiver_balance" ]; then
    echo "New balance ($receiver_balance_after_mint) is not the expected balance ($expected_receiver_balance)"
    exit 1
fi

# Check total supply
total_supply_after_mint=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "totalSupply() (uint256)")
echo "New total supply: $total_supply_after_mint"
expected_total_supply=$((initial_total_supply + 3 + 2))
if [ "$total_supply_after_mint" -ne "$expected_total_supply" ]; then
    echo "New total supply ($total_supply_after_mint) is not the expected total supply ($expected_total_supply)"
    exit 1
fi

# Check ownership (ADDRESS)
token_id=$((first_token_to_mint))
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id)
echo "Owner of $token_id: $nft_owner"
if [ "$nft_owner" != "$ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($ADDRESS)"
    exit 1
fi
token_id=$((first_token_to_mint + 1))
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id)
echo "Owner of $token_id: $nft_owner"
if [ "$nft_owner" != "$ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($ADDRESS)"
    exit 1
fi
token_id=$((first_token_to_mint + 2))
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id)
echo "Owner of $token_id: $nft_owner"
if [ "$nft_owner" != "$ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($ADDRESS)"
    exit 1
fi

# Check ownership (RECEIVER_ADDRESS)
token_id=$((first_token_to_mint + 3))
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id)
echo "Owner of $token_id: $nft_owner"
if [ "$nft_owner" != "$RECEIVER_ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($RECEIVER_ADDRESS)"
    exit 1
fi
token_id=$((first_token_to_mint + 4))
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id)
echo "Owner of $token_id: $nft_owner"
if [ "$nft_owner" != "$RECEIVER_ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($RECEIVER_ADDRESS)"
    exit 1
fi

# Check tokenURI
echo "Check TokenURI method"
first_token_to_mint_uri=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "tokenURI(uint256) (string)" $first_token_to_mint)
echo "Token URI for $first_token_to_mint: $first_token_to_mint_uri"
if [ "$first_token_to_mint_uri" != "\"https://my-nft-metadata.com/$first_token_to_mint.json\"" ]; then
    echo "Token URI ($first_token_to_mint_uri) is not the expected token URI (\"https://my-nft-metadata.com/$first_token_to_mint.json\")"
    exit 1
fi


# ------------
# Burning test
# ------------
echo ""
echo "************"
echo "Burning test"
echo "************"

token_id_to_burn=$((first_token_to_mint))
echo "Burning 1 NFT"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "burn(uint256) ()" $token_id_to_burn

# Check balance
balance_after_burn=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "New balance of $ADDRESS: $balance_after_burn"
expected_balance=$((balance_after_mint - 1))
if [ "$balance_after_burn" -ne "$expected_balance" ]; then
    echo "New balance ($balance_after_burn) is not the expected balance ($expected_balance)"
    exit 1
fi

# Check total supply
total_supply_after_burn=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "totalSupply() (uint256)")
echo "New total supply: $total_supply_after_burn"
expected_total_supply=$total_supply_after_mint
if [ "$total_supply_after_burn" -ne "$expected_total_supply" ]; then
    echo "New total supply ($total_supply_after_burn) is not the expected total supply ($expected_total_supply)"
    exit 1
fi

# Check ownership
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id_to_burn)
echo "Owner of $token_id_to_burn: $nft_owner"
if [ "$nft_owner" != "" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ()"
    exit 1
fi

# -------------------
# Burning revert test
# -------------------
echo ""
echo "*******************"
echo "Burning revert test"
echo "*******************"

token_id_to_burn=$((first_token_to_mint + 3))
echo "Burning 1 NFT from $RECEIVER_ADDRESS (should revert)"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "burn(uint256) ()" $token_id_to_burn

# Check balance
balance_after_burn_revert=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "New balance of $ADDRESS: $balance_after_burn_revert"
expected_balance=$balance_after_burn
if [ "$balance_after_burn_revert" -ne "$expected_balance" ]; then
    echo "New balance ($balance_after_burn_revert) is not the expected balance ($expected_balance)"
    exit 1
fi

receiver_balance_after_burn_revert=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $RECEIVER_ADDRESS)
echo "New balance of $RECEIVER_ADDRESS: $receiver_balance_after_burn_revert"
expected_balance=$receiver_balance_after_mint
if [ "$receiver_balance_after_burn_revert" -ne "$expected_balance" ]; then
    echo "New balance ($receiver_balance_after_burn_revert) is not the expected balance ($expected_balance)"
    exit 1
fi

# Check total supply
total_supply_after_burn_revert=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "totalSupply() (uint256)")
echo "New total supply: $total_supply_after_burn_revert"
expected_total_supply=$total_supply_after_burn
if [ "$total_supply_after_burn_revert" -ne "$expected_total_supply" ]; then
    echo "New total supply ($total_supply_after_burn_revert) is not the expected total supply ($expected_total_supply)"
    exit 1
fi

# Check ownership
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id_to_burn)
echo "Owner of $token_id_to_burn: $nft_owner"
if [ "$nft_owner" != "$RECEIVER_ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($RECEIVER_ADDRESS)"
    exit 1
fi


# -------------
# Transfer test
# -------------
echo ""
echo "*************"
echo "Transfer test"
echo "*************"

token_id_to_transfer=$((first_token_to_mint+1))
echo "Transferring NFT $token_id_to_transfer from $ADDRESS to $RECEIVER_ADDRESS"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "transferFrom(address,address,uint256) ()" $ADDRESS $RECEIVER_ADDRESS $token_id_to_transfer

# Check balances
balance_after_transfer=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "New balance of $ADDRESS: $balance_after_transfer"
expected_balance=$((balance_after_burn - 1))
if [ "$balance_after_transfer" -ne "$expected_balance" ]; then
    echo "New balance ($balance_after_transfer) is not the expected balance ($expected_balance)"
    exit 1
fi

receiver_balance_after_transfer=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $RECEIVER_ADDRESS)
echo "New balance of $RECEIVER_ADDRESS: $receiver_balance_after_transfer"
expected_receiver_balance=$((receiver_balance_after_mint + 1))
if [ "$receiver_balance_after_transfer" -ne "$expected_receiver_balance" ]; then
    echo "New balance ($receiver_balance_after_transfer) is not the expected balance ($expected_receiver_balance)"
    exit 1
fi

# Check total supply
total_supply_after_transfer=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "totalSupply() (uint256)")
echo "New total supply: $total_supply_after_transfer"
expected_total_supply=$total_supply_after_burn
if [ "$total_supply_after_transfer" -ne "$expected_total_supply" ]; then
    echo "New total supply ($total_supply_after_transfer) is not the expected total supply ($expected_total_supply)"
    exit 1
fi

# Check ownership
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id_to_transfer)
echo "Owner of $token_id_to_transfer: $nft_owner"
if [ "$nft_owner" != "$RECEIVER_ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($RECEIVER_ADDRESS)"
    exit 1
fi


# --------------------
# Transfer revert test
# --------------------
echo ""
echo "********************"
echo "Transfer revert test"
echo "********************"

echo "Transferring NFT $token_id_to_transfer from $ADDRESS to $RECEIVER_ADDRESS (should revert)"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "transferFrom(address,address,uint256) ()" $ADDRESS $RECEIVER_ADDRESS $token_id_to_transfer

# Check balances
balance_after_transfer_revert=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "New balance of $ADDRESS: $balance_after_transfer_revert"
expected_balance=$balance_after_transfer
if [ "$balance_after_transfer_revert" -ne "$expected_balance" ]; then
    echo "New balance ($balance_after_transfer_revert) is not the expected balance ($expected_balance)"
    exit 1
fi

receiver_balance_after_transfer_revert=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $RECEIVER_ADDRESS)
echo "New balance of $RECEIVER_ADDRESS: $receiver_balance_after_transfer_revert"
expected_receiver_balance=$receiver_balance_after_transfer
if [ "$receiver_balance_after_transfer_revert" -ne "$expected_receiver_balance" ]; then
    echo "New balance ($receiver_balance_after_transfer_revert) is not the expected balance ($expected_receiver_balance)"
    exit 1
fi

# Check ownership
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id_to_transfer)
echo "Owner of $token_id_to_transfer: $nft_owner"
if [ "$nft_owner" != "$RECEIVER_ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($RECEIVER_ADDRESS)"
    exit 1
fi


# -------------
# Approval test
# -------------
echo ""
echo "*************"
echo "Approval test"
echo "*************"

token_id_to_approve=$((first_token_to_mint + 3))
echo "Approving $ADDRESS to be able to send NFT $token_id_to_approve from $RECEIVER_ADDRESS"
cast send --rpc-url $RPC_URL --private-key $RECEIVER_PRIVATE_KEY $CONTRACT_ADDRESS "approve(address,uint256) ()" $ADDRESS $token_id_to_approve

# Check approved address
approved_address=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "getApproved(uint256) (address)" $token_id_to_approve)
echo "Approved address for token $token_id_to_approve: $approved_address"
if [ "$approved_address" != "$ADDRESS" ]; then
    echo "Approved address ($approved_address) is not the expected approved address ($ADDRESS)"
    exit 1
fi

# -----------------
# TransferFrom test
# -----------------
echo ""
echo "*****************"
echo "TransferFrom test"
echo "*****************"

echo "Transferring NFT $token_id_to_approve from $RECEIVER_ADDRESS to $ADDRESS (by calling transferFrom with $ADDRESS)"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "transferFrom(address,address,uint256) ()" $RECEIVER_ADDRESS $ADDRESS $NFT $token_id_to_approve

# Check balances
balance_after_transfer_from=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "New balance of $ADDRESS: $balance_after_transfer_from"
expected_balance=$((balance_after_transfer + 1))
if [ "$balance_after_transfer_from" -ne "$expected_balance" ]; then
    echo "New balance ($balance_after_transfer_from) is not the expected balance ($expected_balance)"
    exit 1
fi

receiver_balance_after_transfer_from=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $RECEIVER_ADDRESS)
echo "New balance of $RECEIVER_ADDRESS: $receiver_balance_after_transfer_from"
expected_receiver_balance=$((receiver_balance_after_transfer - 1))
if [ "$receiver_balance_after_transfer_from" -ne "$expected_receiver_balance" ]; then
    echo "New balance ($receiver_balance_after_transfer_from) is not the expected balance ($expected_receiver_balance)"
    exit 1
fi

# Check total supply
total_supply_after_transfer_from=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "totalSupply() (uint256)")
echo "New total supply: $total_supply_after_transfer_from"
expected_total_supply=$total_supply_after_transfer
if [ "$total_supply_after_transfer_from" -ne "$expected_total_supply" ]; then
    echo "New total supply ($total_supply_after_transfer_from) is not the expected total supply ($expected_total_supply)"
    exit 1
fi

# Check approved address
approved_address=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "getApproved(uint256) (address)" $token_id_to_approve)
echo "Approved address for token $token_id_to_approve: $approved_address"
if [ "$approved_address" != "0x0000000000000000000000000000000000000000" ]; then
    echo "Approved address ($approved_address) is not the expected approved address (0x0000000000000000000000000000000000000000)"
    exit 1
fi

# Check ownership
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id_to_approve)
echo "Owner of $token_id_to_approve: $nft_owner"
if [ "$nft_owner" != "$ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($ADDRESS)"
    exit 1
fi


# ------------------------
# TransferFrom revert test
# ------------------------
echo ""
echo "************************"
echo "TransferFrom revert test"
echo "************************"

token_id_to_transfer=$((first_token_to_mint + 4))
echo "Transferring NFT $token_id_to_transfer from $RECEIVER_ADDRESS to $ADDRESS (by calling transferFrom with $ADDRESS, should revert)"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "transferFrom(address,address,uint256) ()" $RECEIVER_ADDRESS $ADDRESS $NFT $token_id_to_transfer

# Check balances
balance_after_transfer_from_revert=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "New balance of $ADDRESS: $balance_after_transfer_from_revert"
expected_balance=$balance_after_transfer_from
if [ "$balance_after_transfer_from_revert" -ne "$expected_balance" ]; then
    echo "New balance ($balance_after_transfer_from_revert) is not the expected balance ($expected_balance)"
    exit 1
fi

receiver_balance_after_transfer_from_revert=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $RECEIVER_ADDRESS)
echo "New balance of $RECEIVER_ADDRESS: $receiver_balance_after_transfer_from_revert"
expected_receiver_balance=$receiver_balance_after_transfer_from
if [ "$receiver_balance_after_transfer_from_revert" -ne "$expected_receiver_balance" ]; then
    echo "New balance ($receiver_balance_after_transfer_from_revert) is not the expected balance ($expected_receiver_balance)"
    exit 1
fi

# Check approved address
approved_address=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "getApproved(uint256) (address)" $token_id_to_transfer)
echo "Approved address for token $token_id_to_transfer: $approved_address"
if [ "$approved_address" != "0x0000000000000000000000000000000000000000" ]; then
    echo "Approved address ($approved_address) is not the expected approved address (0x0000000000000000000000000000000000000000)"
    exit 1
fi

# Check ownership
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id_to_transfer)
echo "Owner of $token_id_to_transfer: $nft_owner"
if [ "$nft_owner" != "$RECEIVER_ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($RECEIVER_ADDRESS)"
    exit 1
fi

# ----------------------
# Operator approval test
# ----------------------
echo ""
echo "**********************"
echo "Operator approval test"
echo "**********************"

echo "Approving $ADDRESS to be able to send all NFTs from $RECEIVER_ADDRESS"
cast send --rpc-url $RPC_URL --private-key $RECEIVER_PRIVATE_KEY $CONTRACT_ADDRESS "setApprovalForAll(address,bool) ()" $ADDRESS true

# Check operator approved address
operator_is_approved=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "isApprovedForAll(address,address) (bool)" $RECEIVER_ADDRESS $ADDRESS)
echo "Operator $ADDRESS is approved for owner $RECEIVER_ADDRESS: $operator_is_approved"
if [ "$operator_is_approved" != true ]; then
    echo "Operator $ADDRESS is not approved for owner $RECEIVER_ADDRESS ($operator_is_approved)"
    exit 1
fi

# ------------------------------------------
# TransferFrom test (with operator approval)
# ------------------------------------------
echo ""
echo "******************************************"
echo "TransferFrom test (with operator approval)"
echo "******************************************"

token_id_to_transfer=$((first_token_to_mint + 4))
echo "Transferring NFT $token_id_to_transfer from $RECEIVER_ADDRESS to $ADDRESS (by calling transferFrom with $ADDRESS)"
cast send --rpc-url $RPC_URL --private-key $PRIVATE_KEY $CONTRACT_ADDRESS "transferFrom(address,address,uint256) ()" $RECEIVER_ADDRESS $ADDRESS $NFT $token_id_to_transfer

# Check balances
balance_after_transfer_from_with_operator=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $ADDRESS)
echo "New balance of $ADDRESS: $balance_after_transfer_from_with_operator"
expected_balance=$((balance_after_transfer_from + 1))
if [ "$balance_after_transfer_from_with_operator" -ne "$expected_balance" ]; then
    echo "New balance ($balance_after_transfer_from_with_operator) is not the expected balance ($expected_balance)"
    exit 1
fi

receiver_balance_after_transfer_from_with_operator=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "balanceOf(address) (uint256)" $RECEIVER_ADDRESS)
echo "New balance of $RECEIVER_ADDRESS: $receiver_balance_after_transfer_from_with_operator"
expected_receiver_balance=$((receiver_balance_after_transfer_from - 1))
if [ "$receiver_balance_after_transfer_from_with_operator" -ne "$expected_receiver_balance" ]; then
    echo "New balance ($receiver_balance_after_transfer_from_with_operator) is not the expected balance ($expected_receiver_balance)"
    exit 1
fi

# Check total supply
total_supply_after_transfer_from_with_operator=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "totalSupply() (uint256)")
echo "New total supply: $total_supply_after_transfer_from_with_operator"
expected_total_supply=$total_supply_after_transfer_from
if [ "$total_supply_after_transfer_from_with_operator" -ne "$expected_total_supply" ]; then
    echo "New total supply ($total_supply_after_transfer_from_with_operator) is not the expected total supply ($expected_total_supply)"
    exit 1
fi

# Check ownership
nft_owner=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "ownerOf(uint256) (address)" $token_id_to_transfer)
echo "Owner of $token_id_to_transfer: $nft_owner"
if [ "$nft_owner" != "$ADDRESS" ]; then
    echo "NFT owner ($nft_owner) is not the expected owner ($ADDRESS)"
    exit 1
fi

# Removing approval
echo "Removing approval of $ADDRESS to be able to send all NFTs from $RECEIVER_ADDRESS"
cast send --rpc-url $RPC_URL --private-key $RECEIVER_PRIVATE_KEY $CONTRACT_ADDRESS "setApprovalForAll(address,bool) ()" $ADDRESS false

# Check operator approved address
operator_is_approved=$(cast call --rpc-url $RPC_URL $CONTRACT_ADDRESS "isApprovedForAll(address,address) (bool)" $RECEIVER_ADDRESS $ADDRESS)
echo "Operator $ADDRESS is approved for owner $RECEIVER_ADDRESS: $operator_is_approved"
if [ "$operator_is_approved" = true ]; then
    echo "Operator $ADDRESS is not approved for owner $RECEIVER_ADDRESS ($operator_is_approved)"
    exit 1
fi

echo "All tests passed!"

# CONTRACT_ADDRESS= ./scripts/test.sh
