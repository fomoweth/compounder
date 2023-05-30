import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

import { UNISWAP_V3, WETH_ADDRESS } from "../constants/addresses";
import { deployContract } from "../utils/contracts";

import { Swapper, TestCompounder } from "../../../typechain-types";

interface CompleteFixture {
    deployer: SignerWithAddress;
    signers: SignerWithAddress[];
    compounder: TestCompounder;
    swapper: Swapper;
}

export const completeFixture = async (): Promise<CompleteFixture> => {
    const [deployer, ...signers] = await ethers.getSigners();

    const swapper = await deployContract<Swapper>("Swapper", deployer, [
        UNISWAP_V3.FACTORY,
    ]);

    const compounder = await deployContract<TestCompounder>(
        "TestCompounder",
        deployer,
        [WETH_ADDRESS, UNISWAP_V3.FACTORY, UNISWAP_V3.NFT, swapper.address]
    );

    return {
        deployer,
        signers,
        compounder,
        swapper,
    };
};
