import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, constants } from "ethers";
import { ethers } from "hardhat";

import TOKENS from "../constants/tokens";
import { TokenModel } from "../constants/types";
import { getAddress, isNative } from "../utils/addresses";

import {
    IERC20Metadata,
    IERC20Metadata__factory,
} from "../../../typechain-types";

export const getTokens = (targets: string[], sort?: boolean): TokenModel[] => {
    const tokenList = Object.values(TOKENS);

    if (!targets.length) return tokenList;

    const tokens = targets.reduce<TokenModel[]>((acc, target) => {
        const token = tokenList.find(
            (token) => token.symbol.toLowerCase() === target.toLowerCase()
        );

        if (!token) {
            throw new Error("Token not found");
        }

        acc.push(token);

        return acc;
    }, []);

    return !!sort ? sortTokens(tokens) : tokens;
};

export const getToken = (target: string): TokenModel => getTokens([target])[0];

export const sortTokens = <T extends string | TokenModel>(tokens: T[]): T[] => {
    return tokens.sort((tokenA, tokenB) =>
        getAddress(typeof tokenA === "string" ? tokenA : tokenA.address) <
        getAddress(typeof tokenB === "string" ? tokenB : tokenB.address)
            ? -1
            : 1
    );
};

export const getAllowance = async (
    tokenAddress: string,
    spenderAddress: string,
    ownerAddress: string
): Promise<BigNumber> => {
    if (!!isNative(tokenAddress)) return constants.MaxUint256;

    const token = getTokenContract(tokenAddress);
    return await token.allowance(ownerAddress, spenderAddress);
};

export const approve = async (
    tokenAddress: string,
    spenderAddress: string,
    signer: SignerWithAddress,
    amount?: BigNumber
): Promise<void> => {
    if (!amount) amount = constants.MaxUint256;

    const token = getTokenContract(tokenAddress, signer);
    const tx = await token.approve(spenderAddress, amount);
    await tx.wait();

    const allowance = await token.allowance(signer.address, spenderAddress);
    if (!allowance.gt(0)) {
        throw new Error("Failed to approve tokens");
    }
};

export const getBalance = async (
    tokenAddress: string,
    accountAddress: string
): Promise<BigNumber> => {
    if (!!isNative(tokenAddress)) {
        return ethers.provider.getBalance(accountAddress);
    }

    const token = getTokenContract(tokenAddress);
    return await token.balanceOf(accountAddress);
};

export const transfer = async (
    tokenAddress: string,
    amount: BigNumber,
    recipientAddress: string,
    signer: SignerWithAddress
) => {
    const token = getTokenContract(tokenAddress, signer);

    const balanceBefore = await token.balanceOf(recipientAddress);

    const tx = await token.transfer(recipientAddress, amount);
    await tx.wait();

    const balanceAfter = await token.balanceOf(recipientAddress);

    if (!balanceAfter.sub(balanceBefore).gt(0)) {
        throw new Error("Failed to transfer tokens");
    }
};

const getTokenContract = (
    tokenAddress: string,
    signer?: SignerWithAddress
): IERC20Metadata => {
    return IERC20Metadata__factory.connect(
        tokenAddress,
        signer || ethers.provider
    );
};
