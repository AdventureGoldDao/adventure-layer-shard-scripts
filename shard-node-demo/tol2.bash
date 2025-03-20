#!/usr/bin/env bash

set -eu

NITRO_SRC="shards"

DEFAULT_SHARD_BRANCH="adventure-layer-main"
DEFAULT_NITRO_CONTRACTS_VERSION="shard_test"
DEFAULT_TOKEN_BRIDGE_VERSION="v1.2.2"

# The is the latest bold-merge commit in nitro-contracts at the time

# Set default versions if not overriden by provided env vars
: ${NITRO_CONTRACTS_BRANCH:=$DEFAULT_NITRO_CONTRACTS_VERSION}
: ${TOKEN_BRIDGE_BRANCH:=$DEFAULT_TOKEN_BRIDGE_VERSION}
: ${SHARD_BRANCH:=$DEFAULT_SHARD_BRANCH}
export NITRO_CONTRACTS_BRANCH
export TOKEN_BRIDGE_BRANCH
export SHARD_BRANCH

echo "Using NITRO_CONTRACTS_BRANCH: $NITRO_CONTRACTS_BRANCH"
echo "Using TOKEN_BRIDGE_BRANCH: $TOKEN_BRIDGE_BRANCH"
echo "Using SHARD_BRANCH: $SHARD_BRANCH"

mydir=`dirname $0`
cd "$mydir"

if [[ $# -gt 0 ]] && [[ $1 == "script" ]]; then
    shift
    docker compose run scripts "$@"
    exit $?
fi

num_volumes=`docker volume ls --filter label=com.docker.compose.project=shard-node-demo -q | wc -l`

if [[ $num_volumes -eq 0 ]]; then
    force_init=true
else
    force_init=false
fi

run=true
ci=false
validate=false
detach=false
nowait=false
tokenbridge=false
redundantsequencers=0
l2_custom_fee_token=false
l2_custom_fee_token_pricer=false
l2_custom_fee_token_decimals=18
batchposters=1
simple=true
l2anytrust=false



# Rebuild docker images
build_utils=false
force_build_utils=false
build_node_images=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --init)
            if ! $force_init; then
                echo == Warning! this will remove all previous data
                read -p "are you sure? [y/n]" -n 1 response
                if [[ $response == "y" ]] || [[ $response == "Y" ]]; then
                    force_init=true
                    echo
                else
                    exit 0
                fi
            fi
            build_utils=true
            shift
            ;;
        --init-force)
            force_init=true
            build_utils=true
            shift
            ;;
        --ci)
            ci=true
            shift
            ;;
        --build)
            build_utils=true
            build_node_images=true
            shift
            ;;
        --no-build)
            build_utils=false
            build_node_images=false
            shift
            ;;
        --build-utils)
            build_utils=true
            shift
            ;;
        --no-build-utils)
            build_utils=false
            shift
            ;;
        --force-build-utils)
            force_build_utils=true
            shift
            ;;
        --validate)
            simple=false
            validate=true
            shift
            ;;
        --tokenbridge)
            tokenbridge=true
            shift
            ;;
        --no-tokenbridge)
            tokenbridge=false
            shift
            ;;
        --no-run)
            run=false
            shift
            ;;
        --detach)
            detach=true
            shift
            ;;
        --nowait)
            if ! $detach; then
                echo "Error: --nowait requires --detach to be provided."
                exit 1
            fi
            nowait=true
            shift
            ;;
        --batchposters)
            simple=false
            batchposters=$2
            if ! [[ $batchposters =~ [0-3] ]] ; then
                echo "batchposters must be between 0 and 3 value:$batchposters."
                exit 1
            fi
            shift
            shift
            ;;
        --l2-fee-token)
            l2_custom_fee_token=true
            shift
            ;;
        --l2-fee-token-pricer)
            if ! $l3_custom_fee_token; then
                echo "Error: --l2-fee-token-pricer requires --l2-fee-token to be provided."
                exit 1
            fi
            l2_custom_fee_token_pricer=true
            shift
            ;;
        --l2-anytrust)
            l2anytrust=true
            shift
            ;;
        --redundantsequencers)
            simple=false
            redundantsequencers=$2
            if ! [[ $redundantsequencers =~ [0-3] ]] ; then
                echo "redundantsequencers must be between 0 and 3 value:$redundantsequencers."
                exit 1
            fi
            shift
            shift
            ;;
        --simple)
            simple=true
            shift
            ;;
        --no-simple)
            simple=false
            shift
            ;;
        *)
            echo Usage: $0 \[OPTIONS..]
            echo        $0 script [SCRIPT-ARGS]
            echo
            echo OPTIONS:
            echo --build           rebuild docker images
            echo --no-build        don\'t rebuild docker images
            echo --init            remove all data, rebuild, deploy new rollup
            echo --pos             l1 is a proof-of-stake chain \(using prysm for consensus\)
            echo --validate        heavy computation, validating all blocks in WASM
            echo --l2-fee-token    L3 chain is set up to use custom fee token
            echo --l2-fee-token-decimals Number of decimals to use for custom fee token. Only valid if also '--l2-fee-token' is provided
            echo --l2-token-bridge Deploy L1-L2 token bridge.
            echo --l2-anytrust     run the L2 as an AnyTrust chain
            echo --batchposters    batch posters [0-3]
            echo --redundantsequencers redundant sequencers [0-3]
            echo --detach          detach from nodes after running them
            echo --simple          run a simple configuration. one node as sequencer/batch-poster/staker \(default unless using --dev\)
            echo --tokenbridge     deploy L1-L2 token bridge.
            echo --no-tokenbridge  don\'t build or launch tokenbridge
            echo --no-run          does not launch nodes \(useful with build or init\)
            echo --no-simple       run a full configuration with separate sequencer/batch-poster/validator/relayer
            echo --build-utils         rebuild scripts, rollupcreator, token bridge docker images
            echo --no-build-utils      don\'t rebuild scripts, rollupcreator, token bridge docker images
            echo --force-build-utils   force rebuilding utils, useful if NITRO_CONTRACTS_ or TOKEN_BRIDGE_BRANCH changes
            echo
            echo script runs inside a separate docker. For SCRIPT-ARGS, run $0 script --help
            exit 0
    esac
done

NODES="sequencer"
INITIAL_SEQ_NODES="sequencer"

if ! $simple; then
    NODES="$NODES redis"
fi
if [ $redundantsequencers -gt 0 ]; then
    NODES="$NODES sequencer_b"
    INITIAL_SEQ_NODES="$INITIAL_SEQ_NODES sequencer_b"
fi
if [ $redundantsequencers -gt 1 ]; then
    NODES="$NODES sequencer_c"
fi
if [ $redundantsequencers -gt 2 ]; then
    NODES="$NODES sequencer_d"
fi

if [ $batchposters -gt 0 ] && ! $simple; then
    NODES="$NODES poster"
fi
if [ $batchposters -gt 1 ]; then
    NODES="$NODES poster_b"
fi
if [ $batchposters -gt 2 ]; then
    NODES="$NODES poster_c"
fi


if $validate; then
    NODES="$NODES validator"
elif ! $simple; then
    NODES="$NODES staker-unsafe"
fi

if $build_node_images; then
    containers=$(docker ps -a -q -f ancestor=shard-node)
    if [ -n "$containers" ]; then
        docker stop $containers && docker rm $containers
    fi
    docker rmi shard-node 2>/dev/null || true
    if [ -d "$NITRO_SRC" ]; then
      rm -rf $NITRO_SRC
    fi
fi
if [[ "$(docker images -q shard-node:latest 2> /dev/null)" == "" ]]; then
    echo == Building l2
    if [ ! -d "$NITRO_SRC" ]; then
      git clone --branch $SHARD_BRANCH git@github.com:AdventureGoldDao/adventure-layer-sharding.git $NITRO_SRC && cd $NITRO_SRC  && git submodule update --init --recursive --force && cd ..
    fi
    docker build "$NITRO_SRC" -t shard-node --target nitro-node
fi

if $build_utils; then
  LOCAL_BUILD_NODES="scripts rollupcreator"
  # always build tokenbridge in CI mode to avoid caching issues
  if $tokenbridge || $ci; then
    LOCAL_BUILD_NODES="$LOCAL_BUILD_NODES tokenbridge"
  fi

  if [ "$ci" == true ]; then
    # workaround to cache docker layers and keep using docker-compose in CI
    docker buildx bake --allow=fs=/tmp --file docker-compose.yaml --file docker-compose-ci-cache.json $LOCAL_BUILD_NODES
  else
    UTILS_NOCACHE=""
    if $force_build_utils; then
      UTILS_NOCACHE="--no-cache"
    fi
    docker compose build --no-rm $UTILS_NOCACHE $LOCAL_BUILD_NODES
  fi
fi

if $force_init; then
    echo == Removing old data..
    docker compose down
    leftoverContainers=`docker container ls -a --filter label=com.docker.compose.project=shard-node-demo -q | xargs echo`
    if [ `echo $leftoverContainers | wc -w` -gt 0 ]; then
        docker rm $leftoverContainers
    fi
    docker volume prune -f --filter label=com.docker.compose.project=shard-node-demo
    leftoverVolumes=`docker volume ls --filter label=com.docker.compose.project=shard-node-demo -q | xargs echo`
    if [ `echo $leftoverVolumes | wc -w` -gt 0 ]; then
        docker volume rm $leftoverVolumes
    fi

    echo == Get chain id
    docker compose run scripts get_chain

    echo == Generating l1 keys
    docker compose run scripts write-accounts

    echo == Funding validator, sequencer, l2owner
    docker compose run scripts send-l1 --ethamount 1.1 --from l2owner --to validator --wait
    docker compose run scripts send-l1 --ethamount 1 --from l2owner --to sequencer --wait
#    docker compose run scripts send-l1 --ethamount 1 --to l2owner --wait
#    docker compose run scripts send-l1 --ethamount 1 --to user_token_bridge_deployer --wait


    l2ownerAddress=`docker compose run scripts print-address --account l2owner | tail -n 1 | tr -d '\r\n'`
    sequenceraddress=`docker compose run scripts print-address --account sequencer | tail -n 1 | tr -d '\r\n'`
    l2ownerKey=`docker compose run scripts print-private-key --account l2owner | tail -n 1 | tr -d '\r\n'`
    wasmroot=`docker compose run --entrypoint sh sequencer -c "cat /home/user/target/machines/latest/module-root.txt"`

    if $l2anytrust; then
        echo "== Writing l2 chain config (anytrust enabled)"
        docker compose run scripts --l2owner $l2ownerAddress  write-l2-chain-config --anytrust
    else
        echo == Writing l2 chain config
        docker compose run scripts --l2owner $l2ownerAddress  write-l2-chain-config
    fi

    EXTRA_L2_DEPLOY_FLAG=""
    if $l2_custom_fee_token; then
        echo == Deploying custom fee token
        nativeTokenAddress=`docker compose run scripts create-erc20 --l1 --deployer l2owner --bridgeable $tokenbridge --decimals $l2_custom_fee_token_decimals | tail -n 1 | awk '{ print $NF }'`
        EXTRA_L2_DEPLOY_FLAG="-e FEE_TOKEN_ADDRESS=$nativeTokenAddress"
        if $l2_custom_fee_token_pricer; then
            echo == Deploying custom fee token pricer
            feeTokenPricerAddress=`docker compose run scripts create-fee-token-pricer --deployer user_fee_token_deployer | tail -n 1 | awk '{ print $NF }'`
            EXTRA_L2_DEPLOY_FLAG="$EXTRA_L2_DEPLOY_FLAG -e FEE_TOKEN_PRICER_ADDRESS=$feeTokenPricerAddress"
        fi
    fi

    echo == Deploying L2
    docker compose run -e DEPLOYER_PRIVKEY=$l2ownerKey -e BASE_STAKE=1 -e LOSER_STAKE_ESCROW=$sequenceraddress -e STAKE_TOKEN_ADDRESS=l2ownerAddress -e PARENT_CHAIN_RPC=$L1_HTTP_RPC_URL -e PARENT_CHAIN_ID=$L1_CHAIN_ID -e CHILD_CHAIN_NAME=$CHILD_CHAIN_NAME -e OWNER_ADDRESS=$l2ownerAddress -e WASM_MODULE_ROOT=$wasmroot -e SEQUENCER_ADDRESS=$sequenceraddress -e AUTHORIZE_VALIDATORS=5 -e CHILD_CHAIN_CONFIG_PATH="/config/l2_chain_config.json" -e CHAIN_DEPLOYMENT_INFO="/config/deployment.json" -e CHILD_CHAIN_INFO="/config/deployed_chain_info.json" $EXTRA_L2_DEPLOY_FLAG rollupcreator create-rollup-testnode
    docker compose run --entrypoint sh rollupcreator -c "jq [.[]] /config/deployed_chain_info.json > /config/l2_chain_info.json"

    if $tokenbridge; then
        echo == Deploying L1-L2 token bridge
        deployer_key=`printf "%s" "user_token_bridge_deployer" | openssl dgst -sha256 | sed 's/^.*= //'`
        rollupAddress=`docker compose run --entrypoint sh poster -c "jq -r '.[0].rollup.rollup' /config/deployed_chain_info.json | tail -n 1 | tr -d '\r\n'"`
        l2Weth=""
        docker compose run -e PARENT_WETH_OVERRIDE=$l2Weth -e ROLLUP_OWNER_KEY=$l2ownerkey -e ROLLUP_ADDRESS=$rollupAddress -e PARENT_RPC=$L1_HTTP_RPC_URL -e PARENT_KEY=$deployer_key  -e CHILD_RPC=http://sequencer:8547 -e CHILD_KEY=$deployer_key tokenbridge deploy:local:token-bridge
        docker compose run --entrypoint sh tokenbridge -c "cat network.json && cp network.json l1l2_network.json && cp network.json localNetwork.json"
        echo
    fi
fi # $force_init

anytrustNodeConfigLine=""

# Remaining init may require AnyTrust committee/mirrors to have been started
if $l2anytrust; then
    if $force_init; then
        echo == Generating AnyTrust Config
        docker compose run --user root --entrypoint sh datool -c "mkdir /das-committee-a/keys /das-committee-a/data /das-committee-a/metadata /das-committee-b/keys /das-committee-b/data /das-committee-b/metadata /das-mirror/data /das-mirror/metadata"
        docker compose run --user root --entrypoint sh datool -c "chown -R 1000:1000 /das*"
        docker compose run datool keygen --dir /das-committee-a/keys
        docker compose run datool keygen --dir /das-committee-b/keys
        docker compose run scripts write-l2-das-committee-config
        docker compose run scripts write-l2-das-mirror-config

        das_bls_a=`docker compose run --entrypoint sh datool -c "cat /das-committee-a/keys/das_bls.pub"`
        das_bls_b=`docker compose run --entrypoint sh datool -c "cat /das-committee-b/keys/das_bls.pub"`

        docker compose run scripts write-l2-das-keyset-config --dasBlsA $das_bls_a --dasBlsB $das_bls_b
        docker compose run --entrypoint sh datool -c "/usr/local/bin/datool dumpkeyset --conf.file /config/l2_das_keyset.json | grep 'Keyset: ' | awk '{ printf \"%s\", \$2 }' > /config/l2_das_keyset.hex"
        docker compose run scripts set-valid-keyset

        anytrustNodeConfigLine="--anytrust --dasBlsA $das_bls_a --dasBlsB $das_bls_b"
    fi

    if $run; then
        echo == Starting AnyTrust committee and mirror
        docker compose up --wait das-committee-a das-committee-b das-mirror
    fi
fi

if $force_init; then
    if $simple; then
        echo == Writing configs
        docker compose run scripts write-config --simple $anytrustNodeConfigLine
    else
        echo == Writing configs
        docker compose run scripts write-config $anytrustNodeConfigLine

        echo == Initializing redis
        docker compose up --wait redis
        docker compose run scripts redis-init --redundancy $redundantsequencers
    fi

    echo == Funding l2 funnel and dev key
    docker compose up --wait $INITIAL_SEQ_NODES
    sleep 50
    docker compose down
    docker compose up --wait $INITIAL_SEQ_NODES
    sleep 5
    echo == Fund L2 accounts
    if $l2_custom_fee_token; then
        docker compose run scripts bridge-native-token-to-l2 --amount 1000 --from l2owner --wait
    else
        docker compose run scripts bridge-funds --ethamount 5 --wait --from l2owner
    fi
    docker compose run scripts send-l2 --ethamount 1.1 --from l2owner --to validator --wait
    docker compose run scripts send-l2 --ethamount 1 --from l2owner --to sequencer --wait
    echo == Deploy CacheManager on L2
    docker compose run -e CHILD_CHAIN_RPC="http://sequencer:8547" -e CHAIN_OWNER_PRIVKEY=$l2ownerKey rollupcreator deploy-cachemanager-testnode
fi

if $run; then
    UP_FLAG=""
    if $detach; then
        if $nowait; then
            UP_FLAG="--detach"
        else
            UP_FLAG="--wait"
        fi
    fi

    echo == Launching Sequencer
    echo if things go wrong - use --init to create a new chain
    echo

    docker compose up $UP_FLAG $NODES
fi
