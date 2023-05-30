import { BigNumber } from "ethers";
import { ethers } from "hardhat";

export const setDeadline = async (seconds: number = 60): Promise<BigNumber> => {
    const block = await ethers.provider.getBlock("latest");

    if (!block) {
        throw new Error("Failed to fetch block number");
    }

    const deadline = block.timestamp + seconds;

    return BigNumber.from(deadline);
};
