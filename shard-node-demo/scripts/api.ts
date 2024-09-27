import * as consts from "./consts";
import * as fs from "fs";
import axios from "axios";

export const getChainIdStoreCommand = {
    command: "get_chain",
    describe: "get-chain-id-store",
    builder: {
        chainid: {
            number: true,
            describe: "is chain id",
            default: 0,
        },
        filepath: {
            string: true,
            describe: "dev mode",
            default: '',
        },
    },
    handler: async (argv: any) => {
        return await getChainIdStore(argv.chainid,argv.filepath);
    },
};

export async function getChainIdStore(chainid: number = 0, filepath: string = '') {
    const url  = process.env.GET_SHARD_CHAIN_ID_URL || ""
    let key = consts.chainidstore
    if (filepath !== ''){
        key = filepath
    }
    if (chainid) {
        fs.writeFileSync(key, chainid + '', "utf-8");
        return chainid;
    }
    if (fs.existsSync(key)) {
        let cid = fs.readFileSync(key, "utf-8");
        if (cid !== "") {
            return parseInt(cid);
        }
    }
    let { data } = await axios.get(url)
    fs.writeFileSync(key, data.chain_id, "utf-8");
    return data.chain_id;
}