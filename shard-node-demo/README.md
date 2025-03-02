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

### up env
```shell
cp .envrc.example .envrc

direnv allow
```

```shell
./tol2.bash script send-l1 --ethamount 3 --to funnel --wait
```

### look address
```shell
./tol2.bash script print-address --account funnel
```

### look address private-key
```shell
./tol2.bash script print-private-key --account sequencer
```

Initialize the node
```bash
./tol2.bash --init
```

```bash
./tol2.bash script send-l2 --ethamount 1 --to address_0x1111222233334444555566667777888899990000
```

For help and further scripts, see:

```bash
./tol2.bash script --help
```

### cat config
```shell
docker compose run --entrypoint sh sequencer -c "ls /config"
```

### gas token erc20
### 
```shell
# cat tokenAddress is native-token in: docker compose run --entrypoint sh scripts -c "cat /config/l3deployment.json"  
 ./tol2.bash script transfer-erc20 -l1 --token 0x***********Cf13dd6706 --amount 1000 --from user_fee_token_deployer --to l2owner

 ./tol2.bash script bridge-native-token-to-l2 --amount 10 --from l2owner --wait
```

