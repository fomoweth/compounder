import "dotenv/config";
import {
    HardhatNetworkUserConfig,
    HDAccountsUserConfig,
    HttpNetworkUserConfig,
} from "hardhat/types";

import { ChainId } from "../constants/enums";

interface EnvConfig {
    readonly INFURA_API_KEY: string;
    readonly CMC_API_KEY: string;
    readonly EXPLORER_API_KEYS: {
        mainnet?: string;
        optimisticEthereum?: string;
        arbitrumOne?: string;
        polygon?: string;
    };
    readonly MNEMONIC: string;
    readonly REPORT_GAS: boolean;
}

const assertEnvConfig = (
    key: string,
    optional: boolean
): string | undefined => {
    const value = process.env[key];

    if (!optional && !value) {
        throw new Error(`Missing environment variable: ${key}`);
    }

    return value;
};

export const envConfig: EnvConfig = {
    INFURA_API_KEY: assertEnvConfig("INFURA_API_KEY", false)!,
    CMC_API_KEY: assertEnvConfig("CMC_API_KEY", false)!,
    EXPLORER_API_KEYS: {
        mainnet: assertEnvConfig("ETHERSCAN_API_KEY", true),
        optimisticEthereum: assertEnvConfig("OPTIMISMSCAN_API_KEY", true),
        arbitrumOne: assertEnvConfig("POLYSCAN_API_KEY", true),
        polygon: assertEnvConfig("ARBISCAN_API_KEY", true),
    },
    MNEMONIC:
        assertEnvConfig("MNEMONIC", true) ||
        "test test test test test test test test test test test junk",
    REPORT_GAS: assertEnvConfig("REPORT_GAS", true) === "true",
};

const getAccounts = (count: number = 20): HDAccountsUserConfig => {
    return {
        mnemonic: envConfig.MNEMONIC,
        initialIndex: 0,
        count: count,
        path: "m/44'/60'/0'/0",
    };
};

const RPC_URL: { [id in ChainId]: string } = {
    [ChainId.MAINNET]: "https://mainnet.infura.io/v3/",
    [ChainId.OPTIMISM]: "https://optimism-mainnet.infura.io/v3/",
    [ChainId.POLYGON]: "https://polygon-mainnet.infura.io/v3/",
    [ChainId.ARBITRUM]: "https://arbitrum-mainnet.infura.io/v3/",
};

export const getRpcUrl = (chainId: ChainId): string => {
    return RPC_URL[chainId].concat(envConfig.INFURA_API_KEY);
};

export const getHardhatNetworkConfig = (
    chainId: ChainId
): HardhatNetworkUserConfig => {
    return {
        allowUnlimitedContractSize: false,
        chainId: chainId,
        forking: {
            url: getRpcUrl(chainId),
        },
        accounts: getAccounts(),
    };
};

export const getNetworkConfig = (chainId: ChainId): HttpNetworkUserConfig => {
    return {
        chainId: chainId,
        url: getRpcUrl(chainId),
        accounts: getAccounts(),
    };
};
