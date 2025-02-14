# adventure-layer-shard-scripts

A toolkit for deploying and managing layer-2 sharding nodes based on Nitro technology. This project provides scripts and tools for setting up and managing shard nodes in a development environment.

## Overview

This repository contains scripts and configurations for running a complete layer-2 shard node environment, including:
- Local development mode geth L1
- Multiple instance support with different roles
- Sequencer and validator node management
- Token bridge functionality
- Stylus support (optional)

## Directory Structure

adventure-layer-shard-scripts/
├── shard-node-demo/         # Main shard node implementation
│   ├── scripts/            # Core TypeScript scripts for node management
│   ├── tokenbridge/        # Token bridge implementation
│   ├── rollupcreator/      # Rollup creation and management
│   └── bin/               # Binary executables
├── stylus-demos/           # Stylus integration examples
└── machines/              # Machine configurations

## Features

- **Multi-Role Node Support**:
  - Sequencer node management
  - Validator node deployment
  - Batch poster functionality
  - Redis-based coordination

- **Token Bridge Integration**:
  - L1-L2 token bridge deployment
  - ERC20 token management
  - Bridge fund transfers

- **Development Tools**:
  - Local testnet deployment
  - Configuration generators
  - Wallet management utilities
  - Chain ID management

## Requirements

* bash shell
* docker and docker-compose
* Node.js 18+
* All components must be installed in PATH

## Installation

### Using latest nitro release (recommended)

1. Clone the repository:
```bash
git clone https://github.com/AdventureGoldDao/adventure-layer-shard-scripts.git
cd shard-node-demo
```

2. Initialize the environment:
```bash
cp .envrc.example .envrc

# test access cp to .envrc
./init_env

direnv allow
 
./tol2.bash --init
```

To see more options, use `--help`.

## Working with Docker Containers

**sequencer** is the main docker container used to access the nitro testchain. Its http and websocket interfaces are exposed at localhost ports 8587 and 8588 respectively.

Stopping and restarting nodes can be done with docker-compose.

## Helper Scripts

Some helper scripts are provided for simple testing of basic actions:

### Fund Management
To fund the PRIVATE_KEY on L2:
```bash
./tol2.bash script send-l2 --to $PRIVATE_KEY --from $SHARD_ADMIN_PRIVATE_KEY --ethamount 1
```

### L2 TO SHARD Bridge Funds:
```bash
./tol2.bash script bridge-funds --wait --ethamount 1 --from $SHARD_ADMIN_PRIVATE_KEY
```

For help and further scripts, see:
```bash
./tol2.bash script --help
```

### Run to L2
```bash
./tol2.bash --detach
```

## Key Components

1. **Sequencer Node**:
   - HTTP/WebSocket interfaces (ports 8587/8588)
   - Primary chain interaction point
   - Transaction sequencing and ordering

2. **Validator Node**:
   - Transaction validation
   - Block production
   - Chain security maintenance

3. **Token Bridge**:
   - Cross-chain asset transfers
   - ERC20 token management
   - Bridge fund management

## Configuration

The project uses several configuration files:
- `.envrc`: Environment variables
- `l2_chain_config.json`: L2 chain configuration
- `prysm.yaml`: Consensus configuration
- Various node-specific configs in the `/config` directory

## Stylus Support

The project includes Stylus integration examples in the `stylus-demos` directory. This allows for enhanced smart contract functionality and improved performance.

For deploying and testing Stylus contracts:
1. Copy environment configuration: `cp ./scripts/.env.example ./scripts/.env`
2. Use deployment scripts in the `scripts` folder
3. Test functionality using provided test scripts

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For support and questions, please open an issue in the GitHub repository.





