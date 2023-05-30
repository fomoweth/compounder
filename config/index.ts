import "dotenv/config";
import { HDAccountsUserConfig } from "hardhat/types";

interface EnvConfig {
    readonly INFURA_API_KEY: string;
    readonly CMC_API_KEY: string;
    readonly ETHERSCAN_API_KEY: string;
    readonly MNEMONIC: string | undefined;
    readonly FORK_BLOCK_NUMBER: string | undefined;
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
    ETHERSCAN_API_KEY: assertEnvConfig("ETHERSCAN_API_KEY", true)!,
    MNEMONIC: assertEnvConfig("MNEMONIC", true),
    FORK_BLOCK_NUMBER: assertEnvConfig("FORK_BLOCK_NUMBER", true),
    REPORT_GAS: assertEnvConfig("REPORT_GAS", true) === "true",
};

export const getAccounts = (count: number = 20): HDAccountsUserConfig => {
    return {
        mnemonic:
            envConfig.MNEMONIC ||
            "test test test test test test test test test test test junk",
        initialIndex: 0,
        count: count,
        path: "m/44'/60'/0'/0",
    };
};

export const FORK_BLOCK_NUMBER = !!envConfig.FORK_BLOCK_NUMBER
    ? +envConfig.FORK_BLOCK_NUMBER
    : undefined;

export const RPC_URL = "https://mainnet.infura.io/v3/".concat(
    envConfig.INFURA_API_KEY
);
