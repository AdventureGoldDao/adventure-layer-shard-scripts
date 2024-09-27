import { hideBin } from "yargs/helpers";
import Yargs from "yargs/yargs";
import { stressOptions } from "./stress";
import { redisReadCommand, redisInitCommand } from "./redis";
import { getChainIdStoreCommand } from "./api";
import {writeConfigCommand, writePrysmCommand, writeL2ChainConfigCommand, writeAccountsCommand} from "./config";
import {
    bridgeFundsCommand,
    createERC20Command,
    transferERC20Command,
    sendL1Command,
    sendL2Command,
    sendRPCCommand,
    waitForSyncCommand,
} from "./ethcommands";


async function main() {
    await Yargs(hideBin(process.argv))
        .options({
            redisUrl: { string: true, default: "redis://redis:6379" },
            l2url: { string: true, default: process.env.L2_RPC_URL },
            shardUrl: { string: true, default: "ws://sequencer:8548" },
            validationNodeUrl: { string: true, default: "ws://validation_node:8549" },
            shardOwner: { string: true, default: process.env.SHARD_ADMIN_ADDRESS },
        })
        .options(stressOptions)
        .command(bridgeFundsCommand)
        .command(createERC20Command)
        .command(transferERC20Command)
        .command(sendL1Command)
        .command(sendL2Command)
        .command(sendRPCCommand)
        .command(writeAccountsCommand)
        .command(writeConfigCommand)
        .command(writeL2ChainConfigCommand)
        .command(writePrysmCommand)
        .command(redisReadCommand)
        .command(redisInitCommand)
        .command(getChainIdStoreCommand)
        .command(waitForSyncCommand)
        .strict()
        .demandCommand(1, "a command must be specified")
        .help().argv;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
