#!/bin/bash

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


# Deployment
cargo stylus export-abi

# ./scripts/abi.sh
