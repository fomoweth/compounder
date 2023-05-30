import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-tracer";

import { envConfig, FORK_BLOCK_NUMBER, getAccounts, RPC_URL } from "./config";

const config: HardhatUserConfig = {
    paths: {
        artifacts: "./artifacts",
        cache: "./cache",
        sources: "./contracts",
        tests: "./test",
    },
    solidity: {
        compilers: [
            {
                version: "0.8.15",
                settings: {
                    viaIR: true,
                    evmVersion: "istanbul",
                    optimizer: {
                        enabled: true,
                        runs: 1_000_000,
                    },
                    metadata: {
                        bytecodeHash: "none",
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: false,
            chainId: 1,
            forking: {
                url: RPC_URL,
                blockNumber: FORK_BLOCK_NUMBER,
            },
            accounts: getAccounts(),
        },
        mainnet: {
            chainId: 1,
            url: RPC_URL,
            accounts: getAccounts(),
        },
    },
    etherscan: {
        apiKey: envConfig.ETHERSCAN_API_KEY,
    },
    gasReporter: {
        enabled: envConfig.REPORT_GAS,
        coinmarketcap: envConfig.CMC_API_KEY,
        currency: "USD",
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: true,
        strict: true,
    },
    mocha: {
        timeout: 200000,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
};

export default config;
