import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-tracer";

import { envConfig, getHardhatNetworkConfig, getNetworkConfig } from "./config";
import { ChainId } from "./constants/enums";

const config: HardhatUserConfig = {
    solidity: "0.8.17",
};

export default config;
