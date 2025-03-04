import * as consts from "./consts";
import * as fs from "fs";
import axios from "axios";
import * as crypto from 'crypto';
import {ethers} from "ethers";

// Define a command for getting the chain ID and storing it
export const getChainIdStoreCommand = {
    command: "get_chain",
    describe: "get-chain-id-store",
    builder: {
        chainid: {
            number: true, // Specify that chainid should be a number
            describe: "is chain id",
            default: 0, // Default value for chainid
        },
        filepath: {
            string: true, // Specify that filepath should be a string
            describe: "dev mode",
            default: '', // Default value for filepath
        },
    },
    handler: async (argv: any) => {
        // Call the getChainIdStore function with the provided arguments
        return await getChainIdStore(argv.chainid, argv.filepath);
    },
};

// Function to get and store the chain ID
export async function getChainIdStore(chainid: number = 0, filepath: string = '') {
    const url  = process.env.GET_SHARD_CHAIN_ID_URL || ""; // Get the URL from environment variables
    let key = consts.chainidstore; // Default key for storing chain ID
    if (filepath !== '') {
        key = filepath; // Use filepath as key if provided
    }
    if (chainid) {
        // If chainid is provided, write it to the file
        fs.writeFileSync(key, chainid + '', "utf-8");
        return chainid;
    }
    if (fs.existsSync(key)) {
        // If the file exists, read the chain ID from it
        let cid = fs.readFileSync(key, "utf-8");
        if (cid !== "") {
            return parseInt(cid); // Return the chain ID as an integer
        }
    }
    // If no chain ID is found, fetch it from the URL
    let { data } = await axios.get(url);
    fs.writeFileSync(key, data.chain_id + '', "utf-8"); // Write the fetched chain ID to the file
    return data.chain_id; // Return the fetched chain ID
}


export const sendHeartbeatCommand = {
    command: "send-heartbeat",
    describe: "Send heartbeat request",
    builder: {
        contractAddress: { string: true, describe: "contractAddress" },
        accountPublicKey: { string: true, describe: "accountPublicKey" },
        interval: { number: true, describe: "interval" },
        start: { boolean: true, describe: "Start or Stop",default: false },
    },
    handler: async (argv: any) => {
        const rpcProvider = new ethers.providers.JsonRpcProvider(argv.l2url)
        const sign = generateSignature(argv);
        console.log("api params",[argv.contractAddress,argv.accountPublicKey,argv.interval,argv.start,sign])
        const syncRes = await rpcProvider.send("adv_manageContractTask", [argv.contractAddress,argv.accountPublicKey,argv.interval,argv.start,sign])
        console.log("send-heartbeat Response:", syncRes)
    },
};

function generateSignature(argv: { contractAddress: any; accountPublicKey: any; interval: any; } ): string {
    const key = process.env.HEART_BEAT_SIGN_KEY;
    if (!key) {
        throw new Error("HEART_BEAT_SIGN_KEY is not set");
    }
    const data = `${argv.contractAddress}${argv.accountPublicKey}${argv.interval}${key}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}
