import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";

import { UNISWAP_V3, WETH_ADDRESS } from "./shared/constants/addresses";
import { PoolFee, TICK_SPACING } from "./shared/constants/enums";
import { TokenModel } from "./shared/constants/types";

import { completeFixture } from "./shared/helpers/fixtures";
import { seedTokens } from "./shared/helpers/funds";
import { makeSuite } from "./shared/helpers/suite";
import { approve, getBalance, getTokens } from "./shared/helpers/tokens";
import { getNft, getPool, getSwapRouter } from "./shared/helpers/uniswap";

import { setDeadline } from "./shared/utils/deadline";
import { tickBands } from "./shared/utils/ticks";

import { Compounder } from "../typechain-types";

makeSuite({ title: "Compounder" }, () => {
    context("Deployment", () => {
        it("should successfully deploy the core contracts with valid constructor params", async () => {
            const { deployer, compounder, swapper } = await loadFixture(
                completeFixture
            );

            expect(await compounder.WETH()).to.be.eq(WETH_ADDRESS);
            expect(await compounder.factory()).to.be.eq(UNISWAP_V3.FACTORY);
            expect(await compounder.nft()).to.be.eq(UNISWAP_V3.NFT);
            expect(await compounder.owner()).to.be.eq(deployer.address);
            expect(await compounder.swapper()).to.be.eq(swapper.address);
            expect(await swapper.factory()).to.be.eq(UNISWAP_V3.FACTORY);
        });
    });

    behavesLikeCompounder({
        tokens: getTokens(["WETH", "LINK"], true),
        fee: PoolFee.MEDIUM,
        ethAmount: 15,
        percentage: 8,
        ownersCount: 2,
        tradersCount: 5,
    });

    behavesLikeCompounder({
        tokens: getTokens(["WETH", "UNI"], true),
        fee: PoolFee.MEDIUM,
        ethAmount: 15,
        percentage: 8,
        ownersCount: 2,
        tradersCount: 5,
    });

    behavesLikeCompounder({
        tokens: getTokens(["WETH", "USDC"], true),
        fee: PoolFee.MEDIUM,
        ethAmount: 15,
        percentage: 8,
        ownersCount: 2,
        tradersCount: 5,
    });

    behavesLikeCompounder({
        tokens: getTokens(["WETH", "WBTC"], true),
        fee: PoolFee.MEDIUM,
        ethAmount: 15,
        percentage: 8,
        ownersCount: 2,
        tradersCount: 5,
    });
});

function behavesLikeCompounder(params: {
    tokens: TokenModel[];
    fee: PoolFee;
    ethAmount: number;
    percentage: number;
    ownersCount: number;
    tradersCount: number;
}) {
    let token0: TokenModel = params.tokens[0];
    let token1: TokenModel = params.tokens[1];
    let fee: PoolFee = params.fee;
    let tickSpacing: number = TICK_SPACING[fee];

    let title: string = `${token0.symbol}-${token1.symbol}/${fee / 10000}%`;

    describe(title, () => {
        describe("#mint", () => {
            it("should successfully mint NFT with supplying both tokens", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const pool = await getPool(token0.address, token1.address, fee);

                for (const owner of signers.slice(0, params.ownersCount)) {
                    const [amount0Desired, amount1Desired] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    expect(amount0Desired && amount1Desired).to.be.gt(0);

                    await Promise.all([
                        approve(token0.address, compounder.address, owner),
                        approve(token1.address, compounder.address, owner),
                    ]);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const deadline = await setDeadline();

                    await compounder.connect(owner).mint({
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: deadline,
                    });

                    const [balance0After, balance1After] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(balance0After).to.be.lt(amount0Desired);
                    expect(balance1After).to.be.lt(amount1Desired);

                    const tokenIds = await compounder.getPositions(
                        owner.address
                    );
                    const idx = tokenIds.length - 1;
                    const tokenId = tokenIds[idx];

                    expect(await compounder.ownerOf(tokenId)).to.be.eq(
                        owner.address
                    );
                }
            });

            it("should successfully mint NFT with supplying token0 only", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const pool = await getPool(token0.address, token1.address, fee);

                for (const owner of signers.slice(0, params.ownersCount)) {
                    await seedTokens(token0, params.ethAmount, [owner.address]);

                    const [amount0Desired, amount1Desired] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(amount0Desired).to.be.gt(0);
                    expect(amount1Desired).to.be.eq(0);

                    await approve(token0.address, compounder.address, owner);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const deadline = await setDeadline();

                    await compounder.connect(owner).mint({
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: deadline,
                    });

                    const balance0After = await getBalance(
                        token0.address,
                        owner.address
                    );

                    expect(balance0After).to.be.lt(amount0Desired);

                    const tokenIds = await compounder.getPositions(
                        owner.address
                    );
                    const idx = tokenIds.length - 1;
                    const tokenId = tokenIds[idx];

                    expect(await compounder.ownerOf(tokenId)).to.be.eq(
                        owner.address
                    );
                }
            });

            it("should successfully mint NFT with supplying token1 only", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const pool = await getPool(token0.address, token1.address, fee);

                for (const owner of signers.slice(0, params.ownersCount)) {
                    await seedTokens(token1, params.ethAmount, [owner.address]);

                    const [amount0Desired, amount1Desired] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(amount0Desired).to.be.eq(0);
                    expect(amount1Desired).to.be.gt(0);

                    await approve(token1.address, compounder.address, owner);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const deadline = await setDeadline();

                    await compounder.connect(owner).mint({
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: deadline,
                    });

                    const balance1After = await getBalance(
                        token1.address,
                        owner.address
                    );

                    expect(balance1After).to.be.lt(amount1Desired);

                    const tokenIds = await compounder.getPositions(
                        owner.address
                    );
                    const idx = tokenIds.length - 1;
                    const tokenId = tokenIds[idx];

                    expect(await compounder.ownerOf(tokenId)).to.be.eq(
                        owner.address
                    );
                }
            });
        });

        describe("#addLiquidity", () => {
            it("should successfully add liquidity with supplying both tokens", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                for (const owner of signers.slice(0, params.ownersCount)) {
                    const [mintAmount0, mintAmount1] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const mintParams = {
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: mintAmount0,
                        amount1: mintAmount1,
                    };

                    const tokenId = await performMint(
                        compounder,
                        mintParams,
                        owner
                    );

                    const { liquidity: liquidityPrior } = await nft.positions(
                        tokenId
                    );

                    const [amount0Desired, amount1Desired] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    const tx = await compounder.connect(owner).addLiquidity({
                        tokenId: tokenId,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: await setDeadline(),
                    });

                    await tx.wait();

                    const { liquidity: liquidityAfter } = await nft.positions(
                        tokenId
                    );

                    expect(liquidityAfter).to.be.gt(liquidityPrior);
                }
            });

            it("should successfully add liquidity with supplying token0 only", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                for (const owner of signers.slice(0, params.ownersCount)) {
                    await seedTokens(token0, params.ethAmount, [owner.address]);

                    const [mintAmount0, mintAmount1] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(mintAmount0).to.be.gt(0);
                    expect(mintAmount1).to.be.eq(0);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const mintParams = {
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: mintAmount0,
                        amount1: mintAmount1,
                    };

                    const tokenId = await performMint(
                        compounder,
                        mintParams,
                        owner
                    );

                    const { liquidity: liquidityPrior } = await nft.positions(
                        tokenId
                    );

                    const [amount0Desired, amount1Desired] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    const tx = await compounder.connect(owner).addLiquidity({
                        tokenId: tokenId,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: await setDeadline(),
                    });

                    await tx.wait();

                    const { liquidity: liquidityAfter } = await nft.positions(
                        tokenId
                    );

                    expect(liquidityAfter).to.be.gt(liquidityPrior);
                }
            });

            it("should successfully add liquidity with supplying token1 only", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                for (const owner of signers.slice(0, params.ownersCount)) {
                    await seedTokens(token1, params.ethAmount, [owner.address]);

                    const [mintAmount0, mintAmount1] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(mintAmount0).to.be.eq(0);
                    expect(mintAmount1).to.be.gt(0);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const mintParams = {
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: mintAmount0,
                        amount1: mintAmount1,
                    };

                    const tokenId = await performMint(
                        compounder,
                        mintParams,
                        owner
                    );

                    const { liquidity: liquidityPrior } = await nft.positions(
                        tokenId
                    );

                    const [amount0Desired, amount1Desired] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    const tx = await compounder.connect(owner).addLiquidity({
                        tokenId: tokenId,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: await setDeadline(),
                    });

                    await tx.wait();

                    const { liquidity: liquidityAfter } = await nft.positions(
                        tokenId
                    );

                    expect(liquidityAfter).to.be.gt(liquidityPrior);
                }
            });
        });

        describe("#removeLiquidity", () => {
            it("should successfully remove liquidity then collect accrued fees", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                for (const owner of signers.slice(0, params.ownersCount)) {
                    const [amount0Desired, amount1Desired] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const mintParams = {
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                    };

                    const tokenId = await performMint(
                        compounder,
                        mintParams,
                        owner
                    );

                    const { liquidity: liquidityPrior } = await nft.positions(
                        tokenId
                    );

                    const [balance0Prior, balance1Prior] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    await compounder.connect(owner).removeLiquidity({
                        tokenId: tokenId,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: await setDeadline(),
                    });

                    const { liquidity: liquidityAfter } = await nft.positions(
                        tokenId
                    );

                    const [balance0After, balance1After] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(liquidityAfter).to.be.lt(liquidityPrior);
                    expect(balance0After).to.be.gt(balance0Prior);
                    expect(balance1After).to.be.gt(balance1Prior);
                }
            });
        });

        describe("#depositNFT", () => {
            it("should successfully deposit NFT by transferring the token", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const [owner] = signers;

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                const [amount0Desired, amount1Desired] = await Promise.all([
                    seedTokens(token0, params.ethAmount, [owner.address]),
                    seedTokens(token1, params.ethAmount, [owner.address]),
                ]);

                expect(amount0Desired && amount1Desired).to.be.gt(0);

                await Promise.all([
                    approve(token0.address, nft.address, owner),
                    approve(token1.address, nft.address, owner),
                ]);

                const { tick } = await pool.slot0();

                const { tickLower, tickUpper } = tickBands(
                    tick,
                    params.percentage,
                    tickSpacing
                );

                const mintTx = await nft.connect(owner).mint({
                    token0: token0.address,
                    token1: token1.address,
                    fee: fee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: owner.address,
                    deadline: await setDeadline(),
                });

                await mintTx.wait();

                const tokenId = await nft.tokenOfOwnerByIndex(owner.address, 0);

                const transferTx = await nft
                    .connect(owner)
                    ["safeTransferFrom(address,address,uint256)"](
                        owner.address,
                        compounder.address,
                        tokenId
                    );

                await transferTx.wait();

                expect(
                    await nft.tokenOfOwnerByIndex(compounder.address, 0)
                ).to.be.eq(tokenId);

                expect(await compounder.ownerOf(tokenId)).to.be.eq(
                    owner.address
                );
            });
        });

        describe("#withdrawNFT", () => {
            it("should successfully withdraw NFT and remove position", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const [owner] = signers;

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                const [amount0Desired, amount1Desired] = await Promise.all([
                    seedTokens(token0, params.ethAmount, [owner.address]),
                    seedTokens(token1, params.ethAmount, [owner.address]),
                ]);

                expect(amount0Desired && amount1Desired).to.be.gt(0);

                const { tick } = await pool.slot0();

                const { tickLower, tickUpper } = tickBands(
                    tick,
                    params.percentage,
                    tickSpacing
                );

                const mintParams = {
                    token0: token0.address,
                    token1: token1.address,
                    fee: fee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0: amount0Desired,
                    amount1: amount1Desired,
                };

                const tokenId = await performMint(
                    compounder,
                    mintParams,
                    owner
                );

                const [compounderBalancePrior, ownerBalancePrior] =
                    await Promise.all([
                        nft.balanceOf(compounder.address),
                        nft.balanceOf(owner.address),
                    ]);

                const tx = await compounder.connect(owner).withdrawNFT(tokenId);

                await tx.wait();

                const tokenIds = await compounder.getPositions(owner.address);
                expect(tokenIds).to.be.empty;

                const [compounderBalanceAfter, ownerBalanceAfter] =
                    await Promise.all([
                        nft.balanceOf(compounder.address),
                        nft.balanceOf(owner.address),
                    ]);

                expect(compounderBalancePrior).to.be.eq(1);
                expect(ownerBalancePrior).to.be.eq(0);

                expect(compounderBalanceAfter).to.be.eq(0);
                expect(ownerBalanceAfter).to.be.eq(1);
            });

            it("should revert the tx when the sender is not the owner of the token", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const [owner, nonOwner] = signers;

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                const [amount0Desired, amount1Desired] = await Promise.all([
                    seedTokens(token0, params.ethAmount, [owner.address]),
                    seedTokens(token1, params.ethAmount, [owner.address]),
                ]);

                expect(amount0Desired && amount1Desired).to.be.gt(0);

                const { tick } = await pool.slot0();

                const { tickLower, tickUpper } = tickBands(
                    tick,
                    params.percentage,
                    tickSpacing
                );

                const mintParams = {
                    token0: token0.address,
                    token1: token1.address,
                    fee: fee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0: amount0Desired,
                    amount1: amount1Desired,
                };

                const tokenId = await performMint(
                    compounder,
                    mintParams,
                    owner
                );

                const [compounderBalance, ownerBalance, nonOwnerBalance] =
                    await Promise.all([
                        nft.balanceOf(compounder.address),
                        nft.balanceOf(owner.address),
                        nft.balanceOf(nonOwner.address),
                    ]);

                expect(compounderBalance).to.eq(1);
                expect(ownerBalance && nonOwnerBalance).to.be.eq(0);

                await expect(
                    compounder.connect(nonOwner).withdrawNFT(tokenId)
                ).to.be.revertedWithCustomError(compounder, "Restricted");
            });

            it("should revert the tx when invalid token id is given", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const [owner] = signers;

                const pool = await getPool(token0.address, token1.address, fee);

                const [amount0Desired, amount1Desired] = await Promise.all([
                    seedTokens(token0, params.ethAmount, [owner.address]),
                    seedTokens(token1, params.ethAmount, [owner.address]),
                ]);

                expect(amount0Desired && amount1Desired).to.be.gt(0);

                const { tick } = await pool.slot0();

                const { tickLower, tickUpper } = tickBands(
                    tick,
                    params.percentage,
                    tickSpacing
                );

                const mintParams = {
                    token0: token0.address,
                    token1: token1.address,
                    fee: fee,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0: amount0Desired,
                    amount1: amount1Desired,
                };

                const tokenId = await performMint(
                    compounder,
                    mintParams,
                    owner
                );

                await expect(
                    compounder.connect(owner).withdrawNFT(tokenId.add(1))
                ).to.be.revertedWithCustomError(compounder, "Restricted");
            });
        });

        describe("#compound", () => {
            it("should successfully compound the position with given token id with supplying both tokens", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const traders = signers.slice(
                    params.ownersCount,
                    params.tradersCount
                );

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                for (const owner of signers.slice(0, params.ownersCount)) {
                    const [amount0Desired, amount1Desired] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    expect(amount0Desired && amount1Desired).to.be.gt(0);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const mintParams = {
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                    };

                    const tokenId = await performMint(
                        compounder,
                        mintParams,
                        owner
                    );

                    const { liquidity: liquidityPrior } = await nft.positions(
                        tokenId
                    );

                    await simulateSwaps(token0, token1, fee, 10, 5, traders);

                    const [amount0ToAdd, amount1ToAdd] = await Promise.all([
                        seedTokens(token0, params.ethAmount / 2, [
                            owner.address,
                        ]),
                        seedTokens(token1, params.ethAmount / 2, [
                            owner.address,
                        ]),
                    ]);

                    await Promise.all([
                        compounder.updateBalance(
                            token0.address,
                            owner.address,
                            amount0ToAdd
                        ),
                        compounder.updateBalance(
                            token1.address,
                            owner.address,
                            amount1ToAdd
                        ),
                    ]);

                    await expect(compounder.connect(owner).compound(tokenId))
                        .to.emit(compounder, "Compounded")
                        .withArgs(tokenId, anyValue, anyValue, anyValue);

                    const { liquidity: liquidityAfter } = await nft.positions(
                        tokenId
                    );

                    expect(liquidityAfter).to.be.gt(liquidityPrior);

                    const [balance0After, balance1After] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(balance0After).to.be.lt(amount0ToAdd);
                    expect(balance1After).to.be.lt(amount1ToAdd);
                }
            });

            it("should successfully compound the position with given token id with supplying token0 only", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const traders = signers.slice(
                    params.ownersCount,
                    params.tradersCount
                );

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                for (const owner of signers.slice(0, params.ownersCount)) {
                    const [amount0Desired, amount1Desired] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    expect(amount0Desired && amount1Desired).to.be.gt(0);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const mintParams = {
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                    };

                    const tokenId = await performMint(
                        compounder,
                        mintParams,
                        owner
                    );

                    const { liquidity: liquidityPrior } = await nft.positions(
                        tokenId
                    );

                    await simulateSwaps(token0, token1, fee, 10, 5, traders);

                    await seedTokens(token0, params.ethAmount / 2, [
                        owner.address,
                    ]);

                    const [amount0ToAdd, amount1ToAdd] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(amount0ToAdd).to.be.gt(0);
                    expect(amount1ToAdd).to.be.eq(0);

                    await compounder.updateBalance(
                        token0.address,
                        owner.address,
                        amount0ToAdd
                    );

                    await expect(compounder.connect(owner).compound(tokenId))
                        .to.emit(compounder, "Compounded")
                        .withArgs(tokenId, anyValue, anyValue, anyValue);

                    const { liquidity: liquidityAfter } = await nft.positions(
                        tokenId
                    );

                    expect(liquidityAfter).to.be.gt(liquidityPrior);

                    const balance0After = await getBalance(
                        token0.address,
                        owner.address
                    );

                    expect(balance0After).to.be.lt(amount0ToAdd);
                }
            });

            it("should successfully compound the position with given token id with supplying token1 only", async () => {
                const { signers, compounder } = await loadFixture(
                    completeFixture
                );

                const traders = signers.slice(
                    params.ownersCount,
                    params.tradersCount
                );

                const pool = await getPool(token0.address, token1.address, fee);

                const nft = getNft();

                for (const owner of signers.slice(0, params.ownersCount)) {
                    const [amount0Desired, amount1Desired] = await Promise.all([
                        seedTokens(token0, params.ethAmount, [owner.address]),
                        seedTokens(token1, params.ethAmount, [owner.address]),
                    ]);

                    expect(amount0Desired && amount1Desired).to.be.gt(0);

                    const { tick } = await pool.slot0();

                    const { tickLower, tickUpper } = tickBands(
                        tick,
                        params.percentage,
                        tickSpacing
                    );

                    const mintParams = {
                        token0: token0.address,
                        token1: token1.address,
                        fee: fee,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0: amount0Desired,
                        amount1: amount1Desired,
                    };

                    const tokenId = await performMint(
                        compounder,
                        mintParams,
                        owner
                    );

                    const { liquidity: liquidityPrior } = await nft.positions(
                        tokenId
                    );

                    await simulateSwaps(token0, token1, fee, 10, 5, traders);

                    seedTokens(token1, params.ethAmount / 2, [owner.address]);

                    const [amount0ToAdd, amount1ToAdd] = await Promise.all([
                        getBalance(token0.address, owner.address),
                        getBalance(token1.address, owner.address),
                    ]);

                    expect(amount0ToAdd).to.be.eq(0);
                    expect(amount1ToAdd).to.be.gt(0);

                    await compounder.updateBalance(
                        token1.address,
                        owner.address,
                        amount1ToAdd
                    );

                    await expect(compounder.connect(owner).compound(tokenId))
                        .to.emit(compounder, "Compounded")
                        .withArgs(tokenId, anyValue, anyValue, anyValue);

                    const { liquidity: liquidityAfter } = await nft.positions(
                        tokenId
                    );

                    expect(liquidityAfter).to.be.gt(liquidityPrior);

                    const balance1After = await getBalance(
                        token1.address,
                        owner.address
                    );

                    expect(balance1After).to.be.lt(amount1ToAdd);
                }
            });
        });
    });
}

interface MintParams {
    token0: string;
    token1: string;
    fee: PoolFee;
    tickLower: number;
    tickUpper: number;
    amount0: BigNumber;
    amount1: BigNumber;
    amount0Min?: BigNumberish;
    amount1Min?: BigNumberish;
}

const performMint = async (
    compounder: Compounder,
    params: MintParams,
    signer: SignerWithAddress
): Promise<BigNumber> => {
    await Promise.all([
        approve(params.token0, compounder.address, signer),
        approve(params.token1, compounder.address, signer),
    ]);

    const tx = await compounder.connect(signer).mint({
        ...params,
        amount0Min: params.amount0Min || 0,
        amount1Min: params.amount1Min || 0,
        deadline: await setDeadline(),
    });

    await tx.wait();

    const tokenIds = await compounder.getPositions(signer.address);
    const idx = tokenIds.length - 1;
    const tokenId = tokenIds[idx];

    expect(await compounder.ownerOf(tokenId)).to.be.eq(signer.address);

    return tokenId;
};

export const simulateSwaps = async (
    token0: TokenModel,
    token1: TokenModel,
    fee: PoolFee,
    ethAmount: number,
    counter: number,
    signers: SignerWithAddress[]
): Promise<void> => {
    if (token0.address > token1.address) {
        [token0, token1] = [token1, token0];
    }

    const router = getSwapRouter();

    for (const signer of signers) {
        await Promise.all([
            approve(token0.address, router.address, signer),
            approve(token1.address, router.address, signer),
        ]);

        await seedTokens(token0, ethAmount, [signer.address]);

        for (let i = 0; i < counter; i++) {
            const deadline0 = await setDeadline();
            const amount0In = await getBalance(token0.address, signer.address);

            if (!!amount0In.isZero()) {
                throw new Error("Insufficient amount0 in");
            }

            const tx0 = await router.connect(signer).exactInputSingle({
                tokenIn: token0.address,
                tokenOut: token1.address,
                fee: fee,
                recipient: signer.address,
                amountIn: amount0In,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0,
                deadline: deadline0,
            });

            await tx0.wait();

            const deadline1 = await setDeadline();
            const amount1In = await getBalance(token1.address, signer.address);

            if (!!amount1In.isZero()) {
                throw new Error("Insufficient amount1 in");
            }

            const tx1 = await router.connect(signer).exactInputSingle({
                tokenIn: token1.address,
                tokenOut: token0.address,
                fee: fee,
                recipient: signer.address,
                amountIn: amount1In,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0,
                deadline: deadline1,
            });

            await tx1.wait();
        }
    }
};
