# Stylus  example

## Deploying and testing the contract

The `scripts` folder contains two scripts to deploy and test the contract:

1. cp ./scripts/.env.example ./scripts/.env
2. [./scripts/deploy.sh](./scripts/deploy.sh) deploys the contract to the chain specified in the .env file, using cargo-stylus
2. [./scripts/test-erc20.sh](./scripts/test-erc20.sh) performs a series of calls to verify that the contract behaves as expected 

Remember to set the environment variables in an `.env` file.

## Deploying behind a proxy

This project also includes a Solidity Proxy to deploy the ERC-20 or ERC-721 contract behind it, so it can be upgraded in the future. To do this, use the script [./scripts/deployWithProxy.sh](./scripts/deployWithProxy.sh).

To update the logic contract, use the script [./scripts/updateLogic.sh](./scripts/updateLogic.sh).

Note that this Proxy is based on the TransparentUpgradeableProxy of Solidity, but the ERC-20 or ERC-721 contract itself is not Initializable.
