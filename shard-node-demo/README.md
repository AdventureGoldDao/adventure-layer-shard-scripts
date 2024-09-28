# Nitro Testnode

Nitro-testnode brings up a full environment for local nitro testing (with or without Stylus support) including a dev-mode geth L1, and multiple instances with different roles.

### Requirements

* bash shell
* docker and docker-compose

All must be installed in PATH.

## Using latest nitro release (recommended)

### Without Stylus support

Check out the release branch of the repository.

> Notice: release branch may be force-pushed at any time.

```bash
git clone https://github.com/AdventureGoldDao/adventure-layer-shard-scripts.git
cd shard-node-demo
```

Initialize the node

```bash
cp .envrc.example .envrc

# test access cp to .envrc
./init_env

direnv allow
 
./tol2.bash --init
```
To see more options, use `--help`.

### Working with docker containers

**sequencer** is the main docker to be used to access the nitro testchain. It's http and websocket interfaces are exposed at localhost ports 8587 and 8588 ports, respectively.

Stopping, restarting nodes can be done with docker-compose.

### Helper scripts

Some helper scripts are provided for simple testing of basic actions.

To fund the PRIVATE_KEY  on l2, use:

```bash
./tol2.bash script send-l2 --to $PRIVATE_KEY --from $SHARD_ADMIN_PRIVATE_KEY --ethamount 1
```

L2 TO SHARD bridge funds:
```bash
./tol2.bash script bridge-funds --wait --ethamount 1 --from $SHARD_ADMIN_PRIVATE_KEY

```
For help and further scripts, see:

```bash
./tol2.bash script --help
```

## run-to-l2
```bash
./tol2.bash --detach
```

