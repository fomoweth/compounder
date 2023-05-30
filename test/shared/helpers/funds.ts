import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    getStorageAt,
    setStorageAt,
} from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber, BigNumberish, utils } from "ethers";
import { ethers } from "hardhat";

import { ZERO_ADDRESS } from "../constants/addresses";
import { TokenModel } from "../constants/types";
import { parseUnits } from "../utils/units";

import { getLatestAnswerETH } from "./chainlink";

import { IERC20Metadata__factory } from "../../../typechain-types";

export const seedTokens = async (
    token: TokenModel,
    ethAmount: BigNumberish,
    accounts: string[]
): Promise<BigNumber> => {
    if (!BigNumber.isBigNumber(ethAmount)) {
        ethAmount = parseUnits(ethAmount);
    }

    const tokenPrice = await getLatestAnswerETH(token.address);
    const unit = parseUnits(1, token.decimals);
    const seedAmount = ethAmount.mul(unit).div(tokenPrice);
    const value = utils.defaultAbiCoder.encode(["uint256"], [seedAmount]);

    for (const account of accounts) {
        const balanceSlot = utils.keccak256(
            utils.defaultAbiCoder.encode(
                ["address", "uint256"],
                [account, token.slot]
            )
        );

        await setStorageAt(token.address, balanceSlot, value);
    }

    return seedAmount;
};

export const getBalanceSlot = async (tokenAddress: string) => {
    const token = IERC20Metadata__factory.connect(
        tokenAddress,
        ethers.provider
    );

    for (let i = 0; i < 100; i++) {
        let balanceSlot = utils.keccak256(
            utils.defaultAbiCoder.encode(
                ["address", "uint256"],
                [ZERO_ADDRESS, i]
            )
        );

        while (balanceSlot.startsWith("0x0"))
            balanceSlot = "0x" + balanceSlot.slice(3);

        const valuePrior = await getStorageAt(token.address, balanceSlot);
        const balanceToTest =
            valuePrior === utils.defaultAbiCoder.encode(["uint256"], [10])
                ? utils.defaultAbiCoder.encode(["uint256"], [2])
                : utils.defaultAbiCoder.encode(["uint256"], [10]);

        await setStorageAt(token.address, balanceSlot, balanceToTest);

        const balance = await token.balanceOf(ZERO_ADDRESS);

        if (!balance.eq(BigNumber.from(balanceToTest)))
            await setStorageAt(token.address, balanceSlot, valuePrior);

        if (balance.eq(BigNumber.from(balanceToTest))) return i;
    }

    throw new Error("Balance slot not found");
};
