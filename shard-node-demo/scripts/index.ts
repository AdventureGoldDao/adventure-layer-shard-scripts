import { hideBin } from "yargs/helpers";
import Yargs from "yargs/yargs";
import { stressOptions } from "./stress";
import { redisReadCommand, redisInitCommand } from "./redis";
import { getChainIdStoreCommand,sendHeartbeatCommand } from "./api";
import { writeConfigCommand, writeGethGenesisCommand, writePrysmCommand, writeL2ChainConfigCommand, writeL3ChainConfigCommand, writeL2DASCommitteeConfigCommand, writeL2DASMirrorConfigCommand, writeL2DASKeysetConfigCommand } from "./config";
import {
    printAddressCommand,
    namedAccountHelpString,
    writeAccountsCommand,
    printPrivateKeyCommand, namedAddress,
} from "./accounts";
import {
  bridgeFundsCommand,
  bridgeNativeTokenToL2Command,
  bridgeToL3Command,
  createERC20Command,
  createWETHCommand,
  transferERC20Command,
  sendL1Command,
  sendL2Command,
  sendL3Command,
  sendRPCCommand,
  setValidKeysetCommand,
  waitForSyncCommand,
  transferL3ChainOwnershipCommand,
  createFeeTokenPricerCommand,
} from "./ethcommands";

async function main() {
  await Yargs(hideBin(process.argv))
    .options({
      redisUrl: { string: true, default: "redis://redis:6379" },
      l1url: { string: true, default: process.env.L1_RPC_URL as string },
      l2url: { string: true, default: "ws://sequencer:8548" },
      l3url: { string: true, default: "ws://l3node:3348" },
      validationNodeUrl: { string: true, default: "ws://validation_node:8549" },
      l2owner: { string: true, default: namedAddress("l2owner") },
      committeeMember: { string: true, default: "not_set" },
    })
    .options(stressOptions)
    .command(bridgeFundsCommand)
    .command(bridgeToL3Command)
    .command(bridgeNativeTokenToL2Command)
    .command(createERC20Command)
    .command(createFeeTokenPricerCommand)
    .command(createWETHCommand)
    .command(transferERC20Command)
    .command(sendL1Command)
    .command(sendL2Command)
    .command(sendL3Command)
    .command(sendRPCCommand)
    .command(setValidKeysetCommand)
    .command(getChainIdStoreCommand)
    .command(sendHeartbeatCommand)
    .command(transferL3ChainOwnershipCommand)
    .command(writeConfigCommand)
    .command(writeGethGenesisCommand)
    .command(writeL2ChainConfigCommand)
    .command(writeL3ChainConfigCommand)
    .command(writeL2DASCommitteeConfigCommand)
    .command(writeL2DASMirrorConfigCommand)
    .command(writeL2DASKeysetConfigCommand)
    .command(writePrysmCommand)
    .command(writeAccountsCommand)
    .command(printAddressCommand)
    .command(printPrivateKeyCommand)
    .command(redisReadCommand)
    .command(redisInitCommand)
    .command(waitForSyncCommand)
    .strict()
    .demandCommand(1, "a command must be specified")
    .epilogue(namedAccountHelpString)
    .help().argv;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
