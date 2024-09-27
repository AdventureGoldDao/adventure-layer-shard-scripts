import * as consts from "./consts";
import * as fs from "fs";
import axios from "axios";

export const getChainIdStoreCommand = {
    command: "get_chain",
    describe: "get-chain-id-store",
    builder: {
        init: {
            boolean: true,
            describe: "reset the chain id store",
            default: false,
        },
        filepath: {
            string: true,
            describe: "dev mode",
            default: '',
        },
    },
    handler: async (argv: any) => {
        return await getChainIdStore(argv.init,argv.filepath);
    },
};

export async function getChainIdStore(init: boolean = false, filepath: string = '') {
    const url  = process.env.GET_SHARD_CHAIN_ID_URL || ""
    console.log("url:", url)
    let key = consts.chainidstore
    if (filepath !== ''){
        key = filepath
    }
    if (fs.existsSync(key)) {
        let chainid = fs.readFileSync(key, "utf-8");
        if (!init && chainid !== "") {
            return parseInt(chainid);
        }
    }
    let { data } = await axios.get(url)
    fs.writeFileSync(key, data.chain_id+'', "utf-8");
    return data.chain_id;
}