import * as fs from 'fs';
import {getChainIdStore} from './api';
import * as consts from './consts'
import {Wallet} from "ethers";

const path = require("path");

// Function to write Prysm configuration file
function writePrysmConfig(argv: any) {
    const prysm = `
CONFIG_NAME: interop
PRESET_BASE: interop

# Genesis
GENESIS_FORK_VERSION: 0x20000089

# Altair
ALTAIR_FORK_EPOCH: 0
ALTAIR_FORK_VERSION: 0x20000090

# Merge
BELLATRIX_FORK_EPOCH: 0
BELLATRIX_FORK_VERSION: 0x20000091
TERMINAL_TOTAL_DIFFICULTY: 50

# Capella
CAPELLA_FORK_EPOCH: 0
CAPELLA_FORK_VERSION: 0x20000092
MAX_WITHDRAWALS_PER_PAYLOAD: 16

# DENEB
DENEB_FORK_EPOCH: 0
DENEB_FORK_VERSION: 0x20000093

# ELECTRA
ELECTRA_FORK_VERSION: 0x20000094

# Time parameters
SECONDS_PER_SLOT: 2
SLOTS_PER_EPOCH: 6

# Deposit contract
DEPOSIT_CONTRACT_ADDRESS: 0x4242424242424242424242424242424242424242
    `
    // Write the Prysm configuration to a YAML file
    fs.writeFileSync(path.join(consts.configpath, "prysm.yaml"), prysm)
}

// Function to write various configuration files
async function writeConfigs(argv: any) {
    const valJwtSecret = path.join(consts.configpath, "val_jwt.hex")
    const chainInfoFile = path.join(consts.configpath, "l2_chain_info.json")
    const chainId = await getChainIdStore()

    // Base configuration object
    const baseConfig = {
        "parent-chain": {
            "connection": {
                "url": argv.l2url,
            },
        },
        "chain": {
            "id": chainId,
            "info-files": [chainInfoFile],
        },
        "node": {
            "staker": {
                "dangerous": {
                    "without-block-validator": false
                },
                "parent-chain-wallet": {
                    "account": process.env.SHARD_VALIDATOR_ADDRESS,
                    "password": consts.l1passphrase,
                    "pathname": consts.l1keystore,
                },
                "disable-challenge": false,
                "enable": false,
                "staker-interval": "10s",
                "make-assertion-interval": "10s",
                "strategy": "MakeNodes",
            },
            "sequencer": false,
            "dangerous": {
                "no-sequencer-coordinator": false,
                "disable-blob-reader": true,
            },
            "delayed-sequencer": {
                "enable": false
            },
            "seq-coordinator": {
                "enable": false,
                "redis-url": argv.redisUrl,
                "lockout-duration": "30s",
                "lockout-spare": "1s",
                "my-url": "",
                "retry-interval": "0.5s",
                "seq-num-duration": "24h0m0s",
                "update-interval": "3s",
            },
            "batch-poster": {
                "enable": false,
                "redis-url": argv.redisUrl,
                "max-delay": "30s",
                "l1-block-bound": "ignore",
                "parent-chain-wallet": {
                    "account": process.env.SHARD_SEQUENCER_ADDRESS,
                    "password": consts.l1passphrase,
                    "pathname": consts.l1keystore,
                },
                "data-poster": {
                    "redis-signer": {
                        "signing-key": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                    },
                    "wait-for-l1-finality": false
                }
            },
            "block-validator": {
                "validation-server": {
                    "url": argv.validationNodeUrl,
                    "jwtsecret": valJwtSecret,
                }
            }
        },
        "execution": {
            "sequencer": {
                "enable": false,
            },
            "forwarding-target": "null",
        },
        "persistent": {
            "chain": "local"
        },
        "ws": {
            "addr": "0.0.0.0",
            "vhosts": "*",
            "corsdomain": "*"
        },
        "http": {
            "addr": "0.0.0.0",
            "vhosts": "*",
            "corsdomain": "*"
        },
    }

    // Convert base configuration to JSON string
    const baseConfJSON = JSON.stringify(baseConfig)

    if (argv.simple) {
        // Modify configuration for simple mode
        let simpleConfig = JSON.parse(baseConfJSON)
        simpleConfig.node.staker.enable = true
        simpleConfig.node.staker["use-smart-contract-wallet"] = true
        simpleConfig.node.staker.dangerous["without-block-validator"] = true
        simpleConfig.node.sequencer = true
        simpleConfig.node.dangerous["no-sequencer-coordinator"] = true
        simpleConfig.node["delayed-sequencer"].enable = true
        simpleConfig.node["batch-poster"].enable = true
        simpleConfig.node["batch-poster"]["redis-url"] = ""
        simpleConfig.execution["sequencer"].enable = true
        // Write simple configuration to a JSON file
        fs.writeFileSync(path.join(consts.configpath, "sequencer_config.json"), JSON.stringify(simpleConfig))
    } else {
        // Modify configuration for validator mode
        let validatorConfig = JSON.parse(baseConfJSON)
        validatorConfig.node.staker.enable = true
        validatorConfig.node.staker["use-smart-contract-wallet"] = true
        let validconfJSON = JSON.stringify(validatorConfig)
        // Write validator configuration to a JSON file
        fs.writeFileSync(path.join(consts.configpath, "validator_config.json"), validconfJSON)

        // Modify configuration for unsafe staker mode
        let unsafeStakerConfig = JSON.parse(validconfJSON)
        unsafeStakerConfig.node.staker.dangerous["without-block-validator"] = true
        // Write unsafe staker configuration to a JSON file
        fs.writeFileSync(path.join(consts.configpath, "unsafe_staker_config.json"), JSON.stringify(unsafeStakerConfig))

        // Modify configuration for sequencer mode
        let sequencerConfig = JSON.parse(baseConfJSON)
        sequencerConfig.node.sequencer = true
        sequencerConfig.node["seq-coordinator"].enable = true
        sequencerConfig.execution["sequencer"].enable = true
        sequencerConfig.node["delayed-sequencer"].enable = true
        // Write sequencer configuration to a JSON file
        fs.writeFileSync(path.join(consts.configpath, "sequencer_config.json"), JSON.stringify(sequencerConfig))

        // Modify configuration for poster mode
        let posterConfig = JSON.parse(baseConfJSON)
        posterConfig.node["seq-coordinator"].enable = true
        posterConfig.node["batch-poster"].enable = true
        // Write poster configuration to a JSON file
        fs.writeFileSync(path.join(consts.configpath, "poster_config.json"), JSON.stringify(posterConfig))
    }

    // Configuration for validation node
    let validationNodeConfig = JSON.parse(JSON.stringify({
        "persistent": {
            "chain": "local"
        },
        "ws": {
            "addr": "",
        },
        "http": {
            "addr": "",
        },
        "validation": {
            "api-auth": true,
            "api-public": false,
        },
        "auth": {
            "jwtsecret": valJwtSecret,
            "addr": "0.0.0.0",
        },
    }))
    // Write validation node configuration to a JSON file
    fs.writeFileSync(path.join(consts.configpath, "validation_node_config.json"), JSON.stringify(validationNodeConfig))
    const val_jwt = `413579f0a50c510b4f92b502831b34d588b3ecdae0a4f33e429fe5e00d7858b3`
    // Write JWT secret to a file
    fs.writeFileSync(path.join(consts.configpath, "val_jwt.hex"), val_jwt)
}

// Function to write L2 chain configuration
async function writeL2ChainConfig(argv: any) {
    const chainId = await getChainIdStore()
    const l2ChainConfig = {
        "chainId": chainId,
        "homesteadBlock": 0,
        "daoForkSupport": true,
        "eip150Block": 0,
        "eip150Hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "eip155Block": 0,
        "eip158Block": 0,
        "byzantiumBlock": 0,
        "constantinopleBlock": 0,
        "petersburgBlock": 0,
        "istanbulBlock": 0,
        "muirGlacierBlock": 0,
        "berlinBlock": 0,
        "londonBlock": 0,
        "clique": {
            "period": 0,
            "epoch": 0
        },
        "arbitrum": {
            "EnableArbOS": true,
            "AllowDebugPrecompiles": true,
            "DataAvailabilityCommittee": false,
            "InitialArbOSVersion": 30,
            "InitialChainOwner": argv.shardOwner,
            "GenesisBlockNum": 0
        }
    }
    const l2ChainConfigJSON = JSON.stringify(l2ChainConfig)
    // Write L2 chain configuration to a JSON file
    fs.writeFileSync(path.join(consts.configpath, "l2_chain_config.json"), l2ChainConfigJSON)
}

// Function to write account information
async function writeAccounts(key:string) {
    const wallet = new Wallet(key)
    let walletJSON = await wallet.encrypt(consts.l1passphrase);
    // Write encrypted wallet to a file
    fs.writeFileSync(
        path.join(consts.l1keystore, wallet.address + ".key"),
        walletJSON
    );
}

// Command to write account files
export const writeAccountsCommand = {
    command: "write-accounts",
    describe: "writes wallet files",
    builder: {
        pvkey: {
            string: true,
            describe: "l1 account key",
            default: "",
        },
    },
    handler: async (argv: any) => {
        await writeAccounts(argv.pvkey);
    },
};

// Command to write configuration files
export const writeConfigCommand = {
    command: "write-config",
    describe: "writes config files",
    builder: {
        simple: {
          boolean: true,
          describe: "simple config (sequencer is also poster, validator)",
          default: false,
        },
      },
    handler: (argv: any) => {
        writeConfigs(argv)
    }
}

// Command to write Prysm configuration files
export const writePrysmCommand = {
    command: "write-prysm-config",
    describe: "writes prysm config files",
    handler: (argv: any) => {
        writePrysmConfig(argv)
    }
}

// Command to write L2 chain configuration file
export const writeL2ChainConfigCommand = {
    command: "write-shard-chain-config",
    describe: "writes l2 chain config file",
    handler: (argv: any) => {
        writeL2ChainConfig(argv)
    }
}


