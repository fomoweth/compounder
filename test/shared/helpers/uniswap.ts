import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";

import { UNISWAP_V3 } from "../constants/addresses";
import { PoolFee } from "../constants/enums";
import { isZeroAddress } from "../utils/addresses";
import { setNameTag } from "./tracer";

import {
    INonfungiblePositionManager,
    INonfungiblePositionManager__factory,
    IQuoterV2,
    IQuoterV2__factory,
    ISwapRouter,
    ISwapRouter__factory,
    IUniswapV3Factory,
    IUniswapV3Factory__factory,
    IUniswapV3Pool,
    IUniswapV3Pool__factory,
} from "../../../typechain-types";

export const getPosition = async (
    tokenId: BigNumberish
): Promise<{
    nonce: BigNumber;
    operator: string;
    token0: string;
    token1: string;
    fee: number;
    tickLower: number;
    tickUpper: number;
    liquidity: BigNumber;
    feeGrowthInside0LastX128: BigNumber;
    feeGrowthInside1LastX128: BigNumber;
    tokensOwed0: BigNumber;
    tokensOwed1: BigNumber;
}> => {
    const nft = getNft();

    const {
        nonce,
        operator,
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        liquidity,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        tokensOwed0,
        tokensOwed1,
    } = await nft.positions(tokenId);

    return {
        nonce,
        operator,
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        liquidity,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        tokensOwed0,
        tokensOwed1,
    };
};

export const getPool = async (
    tokenA: string,
    tokenB: string,
    fee: PoolFee
): Promise<IUniswapV3Pool> => {
    const factory = getFactory();
    const poolAddress = await factory.getPool(tokenA, tokenB, fee);

    if (!!isZeroAddress(poolAddress)) {
        throw new Error("Pool not exists");
    }

    const pool = IUniswapV3Pool__factory.connect(poolAddress, ethers.provider);
    return pool;
};

export const getFactory = (): IUniswapV3Factory => {
    const factory = IUniswapV3Factory__factory.connect(
        UNISWAP_V3.FACTORY,
        ethers.provider
    );

    setNameTag("V3 Factory", factory.address);

    return factory;
};

export const getNft = (
    signer?: SignerWithAddress
): INonfungiblePositionManager => {
    const nft = INonfungiblePositionManager__factory.connect(
        UNISWAP_V3.NFT,
        signer || ethers.provider
    );

    setNameTag("NonfungiblePositionManger", nft.address);

    return nft;
};

export const getQuoter = (): IQuoterV2 => {
    const quoter = IQuoterV2__factory.connect(
        UNISWAP_V3.QUOTER_V2,
        ethers.provider
    );

    setNameTag("QuoterV2", quoter.address);

    return quoter;
};

export const getSwapRouter = (signer?: SignerWithAddress): ISwapRouter => {
    const router = ISwapRouter__factory.connect(
        UNISWAP_V3.ROUTER,
        signer || ethers.provider
    );

    setNameTag("SwapRouter", router.address);

    return router;
};
