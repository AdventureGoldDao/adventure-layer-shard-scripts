import { runStress } from "./stress";
import { BigNumber, ContractFactory, ethers, Wallet } from "ethers";
import * as consts from "./consts";
import { namedAccount, namedAddress } from "./accounts";
import * as L1GatewayRouter from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/gateway/L1GatewayRouter.sol/L1GatewayRouter.json";
import * as L1AtomicTokenBridgeCreator from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/ethereum/L1AtomicTokenBridgeCreator.sol/L1AtomicTokenBridgeCreator.json";
import * as ERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json";
import * as TestWETH9 from "@arbitrum/token-bridge-contracts/build/contracts/contracts/tokenbridge/test/TestWETH9.sol/TestWETH9.json";
import * as fs from "fs";
import { ARB_OWNER } from "./consts";
const path = require("path");

async function sendTransaction(argv: any, threadId: number) {
    const account = namedAccount(argv.from, threadId).connect(argv.provider)
    const startNonce = await account.getTransactionCount("pending")
    for (let index = 0; index < argv.times; index++) {
        const response = await
            account.sendTransaction({
                to: namedAddress(argv.to, threadId),
                value: ethers.utils.parseEther(argv.ethamount),
                data: argv.data,
                nonce: startNonce + index,
            })
        console.log(response)
        if (argv.wait) {
          const receipt = await response.wait()
          console.log(receipt)
        }
        if (argv.delay > 0) {
            await new Promise(f => setTimeout(f, argv.delay));
        }
    }
}

async function bridgeFunds(argv: any, parentChainUrl: string, chainUrl: string, inboxAddr: string) {
  argv.provider = new ethers.providers.WebSocketProvider(parentChainUrl);

  argv.to = "address_" + inboxAddr;
  argv.data =
    "0x0f4d14e9000000000000000000000000000000000000000000000000000082f79cd90000";

  await runStress(argv, sendTransaction);

  argv.provider.destroy();
  if (argv.wait) {
    const l2provider = new ethers.providers.WebSocketProvider(chainUrl);
    const account = namedAccount(argv.from, argv.threadId).connect(l2provider)
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    while (true) {
      const balance = await account.getBalance()
      if (balance.gte(ethers.utils.parseEther(argv.ethamount))) {
        return
      }
      await sleep(100)
    }
  }
}

async function bridgeNativeToken(argv: any, parentChainUrl: string, chainUrl: string, inboxAddr: string, token: string) {
  argv.provider = new ethers.providers.WebSocketProvider(parentChainUrl);

  argv.to = "address_" + inboxAddr;

  // snapshot balance before deposit
  const childProvider = new ethers.providers.WebSocketProvider(chainUrl);
  const bridger = namedAccount(argv.from, argv.threadId).connect(childProvider)
  const bridgerBalanceBefore = await bridger.getBalance()

  // get token contract
  const bridgerParentChain = namedAccount(argv.from, argv.threadId).connect(argv.provider)
  const nativeTokenContract = new ethers.Contract(token, ERC20.abi, bridgerParentChain)

  // scale deposit amount
  const decimals = await nativeTokenContract.decimals()
  const depositAmount = BigNumber.from(argv.amount).mul(BigNumber.from('10').pow(decimals))

  /// approve inbox to use fee token
  await nativeTokenContract.approve(inboxAddr, depositAmount)

  /// deposit fee token
  const iface = new ethers.utils.Interface(["function depositERC20(uint256 amount)"])
  argv.data = iface.encodeFunctionData("depositERC20", [depositAmount]);

  await runStress(argv, sendTransaction);

  argv.provider.destroy();
  if (argv.wait) {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // calculate amount being minted on child chain
    let expectedMintedAmount = depositAmount
    if(decimals < 18) {
      // inflate up to 18 decimals
      expectedMintedAmount = depositAmount.mul(BigNumber.from('10').pow(18 - decimals))
    } else if(decimals > 18) {
      // deflate down to 18 decimals, rounding up
      const quotient = BigNumber.from('10').pow(decimals - 18)
      expectedMintedAmount = depositAmount.div(quotient)
      if(expectedMintedAmount.mul(quotient).lt(depositAmount)) {
        expectedMintedAmount = expectedMintedAmount.add(1)
      }
    }

    while (true) {
      const bridgerBalanceAfter = await bridger.getBalance()
      if (bridgerBalanceAfter.sub(bridgerBalanceBefore).eq(expectedMintedAmount)) {
        return
      }
      await sleep(100)
    }
  }
}

async function deployERC20Contract(deployerWallet: Wallet, decimals: number): Promise<string> {
    //// Bytecode below is generated from this simple ERC20 token contract which uses custom number of decimals

    // pragma solidity ^0.8.16;
    //
    // import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
    //
    // contract TestToken is ERC20 {
    //     uint8 private immutable _decimals;
    //
    //     constructor(uint8 decimals_, address mintTo) ERC20("AdventureGoldTest", "AGLDT") {
    //         _decimals = decimals_;
    //         _mint(mintTo, 1_000_000_000 * 10 ** decimals_);
    //     }
    //
    //     function decimals() public view virtual override returns (uint8) {
    //         return _decimals;
    //     }
    // }

    const erc20TokenBytecode = "60a060405234801561000f575f80fd5b50604051611ad8380380611ad8833981810160405281019061003191906102f7565b6040518060400160405280601181526020017f416476656e74757265476f6c64546573740000000000000000000000000000008152506040518060400160405280600581526020017f41474c445400000000000000000000000000000000000000000000000000000081525081600390816100ac919061056f565b5080600490816100bc919061056f565b5050508160ff1660808160ff16815250506100f88183600a6100de919061079a565b633b9aca006100ed91906107e4565b6100ff60201b60201c565b50506108f8565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361016d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016101649061087f565b60405180910390fd5b61017e5f838361025960201b60201c565b8060025f82825461018f919061089d565b92505081905550805f808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055508173ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161023c91906108df565b60405180910390a36102555f838361025e60201b60201c565b5050565b505050565b505050565b5f80fd5b5f60ff82169050919050565b61027c81610267565b8114610286575f80fd5b50565b5f8151905061029781610273565b92915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6102c68261029d565b9050919050565b6102d6816102bc565b81146102e0575f80fd5b50565b5f815190506102f1816102cd565b92915050565b5f806040838503121561030d5761030c610263565b5b5f61031a85828601610289565b925050602061032b858286016102e3565b9150509250929050565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f60028204905060018216806103b057607f821691505b6020821081036103c3576103c261036c565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026104257fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826103ea565b61042f86836103ea565b95508019841693508086168417925050509392505050565b5f819050919050565b5f819050919050565b5f61047361046e61046984610447565b610450565b610447565b9050919050565b5f819050919050565b61048c83610459565b6104a06104988261047a565b8484546103f6565b825550505050565b5f90565b6104b46104a8565b6104bf818484610483565b505050565b5b818110156104e2576104d75f826104ac565b6001810190506104c5565b5050565b601f821115610527576104f8816103c9565b610501846103db565b81016020851015610510578190505b61052461051c856103db565b8301826104c4565b50505b505050565b5f82821c905092915050565b5f6105475f198460080261052c565b1980831691505092915050565b5f61055f8383610538565b9150826002028217905092915050565b61057882610335565b67ffffffffffffffff8111156105915761059061033f565b5b61059b8254610399565b6105a68282856104e6565b5f60209050601f8311600181146105d7575f84156105c5578287015190505b6105cf8582610554565b865550610636565b601f1984166105e5866103c9565b5f5b8281101561060c578489015182556001820191506020850194506020810190506105e7565b868310156106295784890151610625601f891682610538565b8355505b6001600288020188555050505b505050505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f8160011c9050919050565b5f808291508390505b60018511156106c05780860481111561069c5761069b61063e565b5b60018516156106ab5780820291505b80810290506106b98561066b565b9450610680565b94509492505050565b5f826106d85760019050610793565b816106e5575f9050610793565b81600181146106fb576002811461070557610734565b6001915050610793565b60ff8411156107175761071661063e565b5b8360020a91508482111561072e5761072d61063e565b5b50610793565b5060208310610133831016604e8410600b84101617156107695782820a9050838111156107645761076361063e565b5b610793565b6107768484846001610677565b9250905081840481111561078d5761078c61063e565b5b81810290505b9392505050565b5f6107a482610447565b91506107af83610267565b92506107dc7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff84846106c9565b905092915050565b5f6107ee82610447565b91506107f983610447565b925082820261080781610447565b9150828204841483151761081e5761081d61063e565b5b5092915050565b5f82825260208201905092915050565b7f45524332303a206d696e7420746f20746865207a65726f2061646472657373005f82015250565b5f610869601f83610825565b915061087482610835565b602082019050919050565b5f6020820190508181035f8301526108968161085d565b9050919050565b5f6108a782610447565b91506108b283610447565b92508282019050808211156108ca576108c961063e565b5b92915050565b6108d981610447565b82525050565b5f6020820190506108f25f8301846108d0565b92915050565b6080516111c86109105f395f61035f01526111c85ff3fe608060405234801561000f575f80fd5b50600436106100a7575f3560e01c8063395093511161006f578063395093511461016557806370a082311461019557806395d89b41146101c5578063a457c2d7146101e3578063a9059cbb14610213578063dd62ed3e14610243576100a7565b806306fdde03146100ab578063095ea7b3146100c957806318160ddd146100f957806323b872dd14610117578063313ce56714610147575b5f80fd5b6100b3610273565b6040516100c09190610ae2565b60405180910390f35b6100e360048036038101906100de9190610b93565b610303565b6040516100f09190610beb565b60405180910390f35b610101610325565b60405161010e9190610c13565b60405180910390f35b610131600480360381019061012c9190610c2c565b61032e565b60405161013e9190610beb565b60405180910390f35b61014f61035c565b60405161015c9190610c97565b60405180910390f35b61017f600480360381019061017a9190610b93565b610383565b60405161018c9190610beb565b60405180910390f35b6101af60048036038101906101aa9190610cb0565b6103b9565b6040516101bc9190610c13565b60405180910390f35b6101cd6103fe565b6040516101da9190610ae2565b60405180910390f35b6101fd60048036038101906101f89190610b93565b61048e565b60405161020a9190610beb565b60405180910390f35b61022d60048036038101906102289190610b93565b610503565b60405161023a9190610beb565b60405180910390f35b61025d60048036038101906102589190610cdb565b610525565b60405161026a9190610c13565b60405180910390f35b60606003805461028290610d46565b80601f01602080910402602001604051908101604052809291908181526020018280546102ae90610d46565b80156102f95780601f106102d0576101008083540402835291602001916102f9565b820191905f5260205f20905b8154815290600101906020018083116102dc57829003601f168201915b5050505050905090565b5f8061030d6105a7565b905061031a8185856105ae565b600191505092915050565b5f600254905090565b5f806103386105a7565b9050610345858285610771565b6103508585856107fc565b60019150509392505050565b5f7f0000000000000000000000000000000000000000000000000000000000000000905090565b5f8061038d6105a7565b90506103ae81858561039f8589610525565b6103a99190610da3565b6105ae565b600191505092915050565b5f805f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050919050565b60606004805461040d90610d46565b80601f016020809104026020016040519081016040528092919081815260200182805461043990610d46565b80156104845780601f1061045b57610100808354040283529160200191610484565b820191905f5260205f20905b81548152906001019060200180831161046757829003601f168201915b5050505050905090565b5f806104986105a7565b90505f6104a58286610525565b9050838110156104ea576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104e190610e46565b60405180910390fd5b6104f782868684036105ae565b60019250505092915050565b5f8061050d6105a7565b905061051a8185856107fc565b600191505092915050565b5f60015f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054905092915050565b5f33905090565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff160361061c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161061390610ed4565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361068a576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161068190610f62565b60405180910390fd5b8060015f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925836040516107649190610c13565b60405180910390a3505050565b5f61077c8484610525565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81146107f657818110156107e8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016107df90610fca565b60405180910390fd5b6107f584848484036105ae565b5b50505050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff160361086a576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161086190611058565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036108d8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016108cf906110e6565b60405180910390fd5b6108e3838383610a68565b5f805f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054905081811015610966576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161095d90611174565b60405180910390fd5b8181035f808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2081905550815f808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef84604051610a4f9190610c13565b60405180910390a3610a62848484610a6d565b50505050565b505050565b505050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f610ab482610a72565b610abe8185610a7c565b9350610ace818560208601610a8c565b610ad781610a9a565b840191505092915050565b5f6020820190508181035f830152610afa8184610aaa565b905092915050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f610b2f82610b06565b9050919050565b610b3f81610b25565b8114610b49575f80fd5b50565b5f81359050610b5a81610b36565b92915050565b5f819050919050565b610b7281610b60565b8114610b7c575f80fd5b50565b5f81359050610b8d81610b69565b92915050565b5f8060408385031215610ba957610ba8610b02565b5b5f610bb685828601610b4c565b9250506020610bc785828601610b7f565b9150509250929050565b5f8115159050919050565b610be581610bd1565b82525050565b5f602082019050610bfe5f830184610bdc565b92915050565b610c0d81610b60565b82525050565b5f602082019050610c265f830184610c04565b92915050565b5f805f60608486031215610c4357610c42610b02565b5b5f610c5086828701610b4c565b9350506020610c6186828701610b4c565b9250506040610c7286828701610b7f565b9150509250925092565b5f60ff82169050919050565b610c9181610c7c565b82525050565b5f602082019050610caa5f830184610c88565b92915050565b5f60208284031215610cc557610cc4610b02565b5b5f610cd284828501610b4c565b91505092915050565b5f8060408385031215610cf157610cf0610b02565b5b5f610cfe85828601610b4c565b9250506020610d0f85828601610b4c565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f6002820490506001821680610d5d57607f821691505b602082108103610d7057610d6f610d19565b5b50919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f610dad82610b60565b9150610db883610b60565b9250828201905080821115610dd057610dcf610d76565b5b92915050565b7f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f775f8201527f207a65726f000000000000000000000000000000000000000000000000000000602082015250565b5f610e30602583610a7c565b9150610e3b82610dd6565b604082019050919050565b5f6020820190508181035f830152610e5d81610e24565b9050919050565b7f45524332303a20617070726f76652066726f6d20746865207a65726f206164645f8201527f7265737300000000000000000000000000000000000000000000000000000000602082015250565b5f610ebe602483610a7c565b9150610ec982610e64565b604082019050919050565b5f6020820190508181035f830152610eeb81610eb2565b9050919050565b7f45524332303a20617070726f766520746f20746865207a65726f2061646472655f8201527f7373000000000000000000000000000000000000000000000000000000000000602082015250565b5f610f4c602283610a7c565b9150610f5782610ef2565b604082019050919050565b5f6020820190508181035f830152610f7981610f40565b9050919050565b7f45524332303a20696e73756666696369656e7420616c6c6f77616e63650000005f82015250565b5f610fb4601d83610a7c565b9150610fbf82610f80565b602082019050919050565b5f6020820190508181035f830152610fe181610fa8565b9050919050565b7f45524332303a207472616e736665722066726f6d20746865207a65726f2061645f8201527f6472657373000000000000000000000000000000000000000000000000000000602082015250565b5f611042602583610a7c565b915061104d82610fe8565b604082019050919050565b5f6020820190508181035f83015261106f81611036565b9050919050565b7f45524332303a207472616e7366657220746f20746865207a65726f20616464725f8201527f6573730000000000000000000000000000000000000000000000000000000000602082015250565b5f6110d0602383610a7c565b91506110db82611076565b604082019050919050565b5f6020820190508181035f8301526110fd816110c4565b9050919050565b7f45524332303a207472616e7366657220616d6f756e74206578636565647320625f8201527f616c616e63650000000000000000000000000000000000000000000000000000602082015250565b5f61115e602683610a7c565b915061116982611104565b604082019050919050565b5f6020820190508181035f83015261118b81611152565b905091905056fea2646970667358221220f954b411f8b7678704c54f58fe0516d811f9d1ba56240912648aea84b165a57a64736f6c634300081a0033";
    const abi = ["constructor(uint8 decimals_, address mintTo)"];
    const tokenFactory = new ContractFactory(abi, erc20TokenBytecode, deployerWallet);
    const token = await tokenFactory.deploy(decimals, deployerWallet.address);
    await token.deployTransaction.wait();

    return token.address;
}

async function deployFeeTokenPricerContract(deployerWallet: Wallet, exchangeRate: BigNumber): Promise<string> {
  //// Bytecode below is generated from this simple FeeTokenPricer contract

  // pragma solidity ^0.8.16;

  // interface IFeeTokenPricer {
  //     /**
  //      * @notice Get the number of child chain's fee tokens per 1 parent chain's native token. Exchange rate must be
  //      *         denominated in 18 decimals.
  //      * @dev    For example, parent chain's native token is ETH, fee token is DAI. If price of 1ETH = 2000DAI, then function should return 2000*1e18.
  //      *         If fee token is USDC instead and price of 1ETH = 2000USDC, function should still return 2000*1e18, no matter that USDC uses 6 decimals.
  //      */
  //     function getExchangeRate() external returns (uint256);
  // }

  // contract ConstantFeeTokenPricer is IFeeTokenPricer {
  //     uint256 immutable public constExchangeRate;
  //     constructor(uint256 _constExchangeRate) {
  //         constExchangeRate = _constExchangeRate;
  //     }

  //     function getExchangeRate() external view returns (uint256) {
  //         return constExchangeRate;
  //     }
  // }

  const feeTokenPricerBytecode = "0x60a0604052348015600e575f80fd5b506040516101c63803806101c68339818101604052810190602e9190606d565b8060808181525050506093565b5f80fd5b5f819050919050565b604f81603f565b81146058575f80fd5b50565b5f815190506067816048565b92915050565b5f60208284031215607f57607e603b565b5b5f608a84828501605b565b91505092915050565b6080516101166100b05f395f8181606a0152608f01526101165ff3fe6080604052348015600e575f80fd5b50600436106030575f3560e01c8063b8910a29146034578063e6aa216c14604e575b5f80fd5b603a6068565b6040516045919060c9565b60405180910390f35b6054608c565b604051605f919060c9565b60405180910390f35b7f000000000000000000000000000000000000000000000000000000000000000081565b5f7f0000000000000000000000000000000000000000000000000000000000000000905090565b5f819050919050565b60c38160b3565b82525050565b5f60208201905060da5f83018460bc565b9291505056fea2646970667358221220ee17f22614d853ccf8b3f854137f68f06ff92f9f71ba8b811d78b1313eead0c564736f6c634300081a0033";
  const abi = ["constructor(uint256 exchangeRate)"];
  const feeTokenPricerFactory = new ContractFactory(abi, feeTokenPricerBytecode, deployerWallet);
  const feeTokenPricer = await feeTokenPricerFactory.deploy(exchangeRate);
  await feeTokenPricer.deployTransaction.wait();

  return feeTokenPricer.address;
}

async function deployWETHContract(deployerWallet: Wallet): Promise<string> {
    const wethFactory = new ContractFactory(TestWETH9.abi, TestWETH9.bytecode, deployerWallet);
    const weth = await wethFactory.deploy("Wrapped Ether", "WETH");
    await weth.deployTransaction.wait();

    return weth.address;
}

export const bridgeFundsCommand = {
  command: "bridge-funds",
  describe: "sends funds from l1 to l2",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait till l2 has balance of ethamount",
      default: false,
    },
  },
  handler: async (argv: any) => {
    const deploydata = JSON.parse(
      fs
        .readFileSync(path.join(consts.configpath, "deployment.json"))
        .toString()
    );
    const inboxAddr = ethers.utils.hexlify(deploydata.inbox);

    await bridgeFunds(argv, argv.l1url, argv.l2url, inboxAddr)
  },
};

export const bridgeToL3Command = {
  command: "bridge-to-l3",
  describe: "sends funds from l2 to l3",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait till l3 has balance of ethamount",
      default: false,
    },
  },
  handler: async (argv: any) => {
    const deploydata = JSON.parse(
      fs
        .readFileSync(path.join(consts.configpath, "l3deployment.json"))
        .toString()
    );
    const inboxAddr = ethers.utils.hexlify(deploydata.inbox);

    await bridgeFunds(argv, argv.l2url, argv.l3url, inboxAddr)
  },
};

export const bridgeNativeTokenToL2Command = {
  command: "bridge-native-token-to-l2",
  describe: "bridge native token from l1 to l2",
  builder: {
    amount: {
      string: true,
      describe: "amount to transfer",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait till l2 has balance of amount",
      default: false,
    },
  },
  handler: async (argv: any) => {
    const deploydata = JSON.parse(
      fs
        .readFileSync(path.join(consts.configpath, "deployment.json"))
        .toString()
    );
    const inboxAddr = ethers.utils.hexlify(deploydata.inbox);
    const nativeTokenAddr = ethers.utils.hexlify(deploydata["native-token"]);

    argv.ethamount = "0"
    await bridgeNativeToken(argv, argv.l1url, argv.l2url, inboxAddr, nativeTokenAddr)
  },
};

export const transferL3ChainOwnershipCommand = {
  command: "transfer-l3-chain-ownership",
  describe: "transfer L3 chain ownership to upgrade executor",
  builder: {
    creator: {
      string: true,
      describe: "address of the token bridge creator",
    },
    wait: {
      boolean: true,
      describe: "wait till ownership is transferred",
      default: false,
    },
  },
  handler: async (argv: any) => {
    // get inbox address from config file
    const deploydata = JSON.parse(
      fs
        .readFileSync(path.join(consts.configpath, "l3deployment.json"))
        .toString()
    );
    const inboxAddr = ethers.utils.hexlify(deploydata.inbox);

    // get L3 upgrade executor address from token bridge creator
    const l2provider = new ethers.providers.WebSocketProvider(argv.l2url);
    const tokenBridgeCreator = new ethers.Contract(argv.creator, L1AtomicTokenBridgeCreator.abi, l2provider);
    const [,,,,,,,l3UpgradeExecutorAddress,] = await tokenBridgeCreator.inboxToL2Deployment(inboxAddr);

    // set TX params
    argv.provider = new ethers.providers.WebSocketProvider(argv.l3url);
    argv.to = "address_" + ARB_OWNER;
    argv.from = "l3owner";
    argv.ethamount = "0";

    // add L3 UpgradeExecutor to chain owners
    const arbOwnerIface = new ethers.utils.Interface([
      "function addChainOwner(address newOwner) external",
      "function removeChainOwner(address ownerToRemove) external"
    ])
    argv.data = arbOwnerIface.encodeFunctionData("addChainOwner", [l3UpgradeExecutorAddress]);
    await runStress(argv, sendTransaction);

    // remove L3 owner from chain owners
    argv.data = arbOwnerIface.encodeFunctionData("removeChainOwner", [namedAccount("l3owner").address]);
    await runStress(argv, sendTransaction);

    argv.provider.destroy();
  }
};

export const createERC20Command = {
  command: "create-erc20",
  describe: "creates simple ERC20 on L1",
  builder: {
    deployer: {
      string: true,
      describe: "account (see general help)"
    },
    bridgeable: {
      boolean: true,
      describe: "if true, deploy on L1 and bridge to L2",
    },
    l1: {
      boolean: true,
      describe: "if true, deploy on L1 only",
    },
    decimals: {
      string: true,
      describe: "number of decimals for token",
      default: "18",
    },
  },
  handler: async (argv: any) => {
    console.log("create-erc20");

    if (argv.bridgeable || argv.l1) {

      // deploy token on l1
      const l1provider = new ethers.providers.WebSocketProvider(argv.l1url);
      const deployerWallet = namedAccount(argv.deployer).connect(l1provider);

      const tokenAddress = await deployERC20Contract(deployerWallet, argv.decimals);
      const token = new ethers.Contract(tokenAddress, ERC20.abi, deployerWallet);
      console.log("Contract deployed at L1 address:", token.address);

      if (!argv.bridgeable) return;

      // bridge to l2
      const l2provider = new ethers.providers.WebSocketProvider(argv.l2url);
      const l1l2tokenbridge = JSON.parse(
        fs
          .readFileSync(path.join(consts.tokenbridgedatapath, "l1l2_network.json"))
          .toString()
      );

      const l1GatewayRouter = new ethers.Contract(l1l2tokenbridge.l2Network.tokenBridge.l1GatewayRouter, L1GatewayRouter.abi, deployerWallet);
      await (await token.functions.approve(l1l2tokenbridge.l2Network.tokenBridge.l1ERC20Gateway, ethers.constants.MaxUint256)).wait();
      const supply = await token.totalSupply();
      // transfer 90% of supply to l2
      const transferAmount = supply.mul(9).div(10);
      await (await l1GatewayRouter.functions.outboundTransfer(
        token.address, deployerWallet.address, transferAmount, 100000000, 1000000000, "0x000000000000000000000000000000000000000000000000000fffffffffff0000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000", {
          value: ethers.utils.parseEther("1"),
        }
      )).wait();

      const tokenL2Addr = (await l1GatewayRouter.functions.calculateL2TokenAddress(token.address))[0];
      // wait for l2 token to be deployed
      for (let i = 0; i < 60; i++) {
        if (await l2provider.getCode(tokenL2Addr) === "0x") {
          await new Promise(f => setTimeout(f, 1000));
        } else {
          break;
        }
      }
      if (await l2provider.getCode(tokenL2Addr) === "0x") {
        throw new Error("Failed to bridge token to L2");
      }

      console.log("Contract deployed at L2 address:", tokenL2Addr);

      l1provider.destroy();
      l2provider.destroy();
      return;
    }

    // no l1-l2 token bridge, deploy token on l2 directly
    argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);
    const deployerWallet = namedAccount(argv.deployer).connect(argv.provider);
    const tokenAddress = await deployERC20Contract(deployerWallet, argv.decimals);
    console.log("Contract deployed at address:", tokenAddress);

    argv.provider.destroy();
  },
};

export const createFeeTokenPricerCommand = {
  command: "create-fee-token-pricer",
  describe: "creates Constant Fee Token Pricer on L2",
  builder: {
    deployer: {
      string: true,
      describe: "account (see general help)"
    },
  },
  handler: async (argv: any) => {
    console.log("create-fee-token-pricer");

    argv.provider = new ethers.providers.WebSocketProvider(argv.l1url);
    const deployerWallet = new Wallet(
      ethers.utils.sha256(ethers.utils.toUtf8Bytes(argv.deployer)),
      argv.provider
    );
    const feeTokenPricerAddress = await deployFeeTokenPricerContract(deployerWallet, BigNumber.from("15000000000000000000"));
    console.log("Contract deployed at address:", feeTokenPricerAddress);

    argv.provider.destroy();
  },
};
// Will revert if the keyset is already valid.
async function setValidKeyset(argv: any, upgradeExecutorAddr: string, sequencerInboxAddr: string, keyset: string){
    const innerIface = new ethers.utils.Interface(["function setValidKeyset(bytes)"])
    const innerData = innerIface.encodeFunctionData("setValidKeyset", [keyset]);

    // The Executor contract is the owner of the SequencerInbox so calls must be made
    // through it.
    const outerIface = new ethers.utils.Interface(["function executeCall(address,bytes)"])
    argv.data = outerIface.encodeFunctionData("executeCall", [sequencerInboxAddr, innerData]);

    argv.from = "l2owner";
    argv.to = "address_" + upgradeExecutorAddr
    argv.ethamount = "0"

    await sendTransaction(argv, 0);

    argv.provider.destroy();
}

export const transferERC20Command = {
  command: "transfer-erc20",
  describe: "transfers ERC20 token",
  builder: {
    token: {
      string: true,
      describe: "token address",
    },
    amount: {
      string: true,
      describe: "amount to transfer",
    },
    from: {
      string: true,
      describe: "account (see general help)",
    },
    to: {
      string: true,
      describe: "address (see general help)",
    },
    l1: {
      boolean: true,
      describe: "if true, transfer on L1",
    },
  },
  handler: async (argv: any) => {
    console.log("transfer-erc20");

    if (argv.l1) {
      argv.provider = new ethers.providers.WebSocketProvider(argv.l1url);
    } else {
      argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);
    }
    const account = namedAccount(argv.from).connect(argv.provider);
    const tokenContract = new ethers.Contract(argv.token, ERC20.abi, account);
    const tokenDecimals = await tokenContract.decimals();
    const amountToTransfer = BigNumber.from(argv.amount).mul(BigNumber.from('10').pow(tokenDecimals));
    await(await tokenContract.transfer(namedAccount(argv.to).address, amountToTransfer)).wait();
    argv.provider.destroy();
  },
};

export const createWETHCommand = {
  command: "create-weth",
  describe: "creates WETH on L1",
  builder: {
    deployer: {
      string: true,
      describe: "account (see general help)"
    },
    deposit: {
      number: true,
      describe: "amount of weth to deposit",
      default: 100,
    }
  },
  handler: async (argv: any) => {
    console.log("create-weth");

    const l1provider = new ethers.providers.WebSocketProvider(argv.l1url);
    const deployerWallet = namedAccount(argv.deployer).connect(l1provider);

    const wethAddress = await deployWETHContract(deployerWallet);
    const weth = new ethers.Contract(wethAddress, TestWETH9.abi, deployerWallet);
    console.log("WETH deployed at L1 address:", weth.address);

    if (argv.deposit > 0) {
      const amount = ethers.utils.parseEther(argv.deposit.toString());
      const depositTx = await deployerWallet.sendTransaction({ to: wethAddress, value: amount, data:"0xd0e30db0" }); // deposit()
      await depositTx.wait();
    }
  },
};

export const sendL1Command = {
  command: "send-l1",
  describe: "sends funds between l1 accounts",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    to: {
      string: true,
      describe: "address (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait for transaction to complete",
      default: false,
    },
    data: { string: true, describe: "data" },
  },
  handler: async (argv: any) => {
    argv.provider = new ethers.providers.WebSocketProvider(argv.l1url);

    await runStress(argv, sendTransaction);

    argv.provider.destroy();
  },
};

export const sendL2Command = {
  command: "send-l2",
  describe: "sends funds between l2 accounts",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    to: {
      string: true,
      describe: "address (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait for transaction to complete",
      default: false,
    },
    data: { string: true, describe: "data" },
  },
  handler: async (argv: any) => {
    argv.provider = new ethers.providers.WebSocketProvider(argv.l2url);

    await runStress(argv, sendTransaction);

    argv.provider.destroy();
  },
};

export const sendL3Command = {
  command: "send-l3",
  describe: "sends funds between l3 accounts",
  builder: {
    ethamount: {
      string: true,
      describe: "amount to transfer (in eth)",
      default: "10",
    },
    from: {
      string: true,
      describe: "account (see general help)",
      default: "funnel",
    },
    to: {
      string: true,
      describe: "address (see general help)",
      default: "funnel",
    },
    wait: {
      boolean: true,
      describe: "wait for transaction to complete",
      default: false,
    },
    data: { string: true, describe: "data" },
  },
  handler: async (argv: any) => {
    argv.provider = new ethers.providers.WebSocketProvider(argv.l3url);

    await runStress(argv, sendTransaction);

    argv.provider.destroy();
  },
};

export const sendRPCCommand = {
    command: "send-rpc",
    describe: "sends rpc command",
    builder: {
        method: { string: true, describe: "rpc method to call", default: "eth_syncing" },
        url: { string: true, describe: "url to send rpc call", default: "http://sequencer:8547"},
        params: { array : true, describe: "array of parameter name/values" },
    },
    handler: async (argv: any) => {
        const rpcProvider = new ethers.providers.JsonRpcProvider(argv.url)

        await rpcProvider.send(argv.method, argv.params)
    }
}

export const setValidKeysetCommand = {
    command: "set-valid-keyset",
    describe: "sets the anytrust keyset",
    handler: async (argv: any) => {
        argv.provider = new ethers.providers.WebSocketProvider(argv.l1url);
        const deploydata = JSON.parse(
            fs
                .readFileSync(path.join(consts.configpath, "deployment.json"))
                .toString()
        );
        const sequencerInboxAddr = ethers.utils.hexlify(deploydata["sequencer-inbox"]);
        const upgradeExecutorAddr = ethers.utils.hexlify(deploydata["upgrade-executor"]);

        const keyset = fs
            .readFileSync(path.join(consts.configpath, "l2_das_keyset.hex"))
            .toString()

        await setValidKeyset(argv, upgradeExecutorAddr, sequencerInboxAddr, keyset)
    }
};

export const waitForSyncCommand = {
  command: "wait-for-sync",
  describe: "wait for rpc to sync",
  builder: {
    url: { string: true, describe: "url to send rpc call", default: "http://sequencer:8547"},
  },
  handler: async (argv: any) => {
    const rpcProvider = new ethers.providers.JsonRpcProvider(argv.url)
    let syncStatus;
    do {
        syncStatus = await rpcProvider.send("eth_syncing", [])
        if (syncStatus !== false) {
            // Wait for a short interval before checking again
            await new Promise(resolve => setTimeout(resolve, 5000))
        }
    } while (syncStatus !== false)
  },
};
