// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/external/Uniswap/V3/IUniswapV3Pool.sol";
import "../interfaces/ISwapper.sol";
import "../libraries/Path.sol";
import "../libraries/PoolAddress.sol";
import "../libraries/SafeCast.sol";
import "../libraries/SwapMath.sol";
import "../libraries/TickBitmap.sol";
import "../libraries/TickMath.sol";
import "../libraries/TransferHelper.sol";
import "../utils/Multicall.sol";
import "../utils/ReentrancyGuard.sol";

contract Swapper is ISwapper, ReentrancyGuard {
    using Path for bytes;
    using SafeCast for uint256;
    using TransferHelper for address;

    error AmountSpecifiedZero();
    error InsufficientAmountOut();
    error InvalidPool();
    error SqrtPriceLimitOutOfBounds();

    address public immutable factory;

    constructor(address _factory) {
        factory = _factory;
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        require(amount0Delta > 0 || amount1Delta > 0);

        (address tokenIn, address tokenOut, uint24 fee) = data
            .decodeFirstPool();

        address pool = computePoolAddress(tokenIn, tokenOut, fee);
        if (pool != msg.sender) revert InvalidPool();

        uint256 amountToPay = amount0Delta > 0
            ? uint256(amount0Delta)
            : uint256(amount1Delta);

        tokenIn.safeTransfer(pool, amountToPay);
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external payable lock returns (uint256 amountOut) {
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = getPool(tokenIn, tokenOut, fee).swap(
            recipient,
            zeroForOne,
            amountIn.toInt256(),
            zeroForOne
                ? TickMath.MIN_SQRT_RATIO + 1
                : TickMath.MAX_SQRT_RATIO - 1,
            abi.encodePacked(tokenIn, fee, tokenOut)
        );

        amountOut = uint256(-(zeroForOne ? amount1 : amount0));

        if (amountOut < amountOutMin) revert InsufficientAmountOut();
    }

    function quote(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        return
            computeAmountOut(
                tokenIn,
                tokenOut,
                fee,
                tokenIn < tokenOut,
                amountIn.toInt256()
            );
    }

    struct SwapState {
        int256 amountSpecifiedRemaining;
        int256 amountCalculated;
        uint160 sqrtPriceX96;
        int24 tick;
        uint128 liquidity;
    }

    struct StepComputations {
        uint160 sqrtPriceStartX96;
        int24 tickNext;
        bool initialized;
        uint160 sqrtPriceNextX96;
        uint256 amountIn;
        uint256 amountOut;
        uint256 feeAmount;
    }

    function computeAmountOut(
        address token0,
        address token1,
        uint24 fee,
        bool zeroForOne,
        int256 amountSpecified
    ) private view returns (uint256 amountOut) {
        if (amountSpecified == 0) revert AmountSpecifiedZero();

        IUniswapV3Pool pool = getPool(token0, token1, fee);

        int24 tickSpacing = pool.tickSpacing();
        (uint160 sqrtPriceX96, int24 tick, , , , , ) = pool.slot0();

        bool exactInput = amountSpecified > 0;

        uint160 sqrtPriceLimitX96 = zeroForOne
            ? TickMath.MIN_SQRT_RATIO + 1
            : TickMath.MAX_SQRT_RATIO - 1;

        require(
            zeroForOne
                ? sqrtPriceLimitX96 < sqrtPriceX96 &&
                    sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO
                : sqrtPriceLimitX96 > sqrtPriceX96 &&
                    sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO
        );

        SwapState memory state = SwapState({
            amountSpecifiedRemaining: amountSpecified,
            amountCalculated: 0,
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            liquidity: pool.liquidity()
        });

        while (
            state.amountSpecifiedRemaining != 0 &&
            state.sqrtPriceX96 != sqrtPriceLimitX96
        ) {
            StepComputations memory step;
            step.sqrtPriceStartX96 = state.sqrtPriceX96;

            (
                step.tickNext,
                step.initialized,
                step.sqrtPriceNextX96
            ) = TickBitmap.nextInitializedTickWithinOneWord(
                pool,
                state.tick,
                tickSpacing,
                zeroForOne
            );

            (
                state.sqrtPriceX96,
                step.amountIn,
                step.amountOut,
                step.feeAmount
            ) = SwapMath.computeSwapStep(
                state.sqrtPriceX96,
                (
                    zeroForOne
                        ? step.sqrtPriceNextX96 < sqrtPriceLimitX96
                        : step.sqrtPriceNextX96 > sqrtPriceLimitX96
                )
                    ? sqrtPriceLimitX96
                    : step.sqrtPriceNextX96,
                state.liquidity,
                state.amountSpecifiedRemaining,
                fee
            );

            if (exactInput) {
                unchecked {
                    state.amountSpecifiedRemaining =
                        state.amountSpecifiedRemaining -
                        (step.amountIn + step.feeAmount).toInt256();
                }

                state.amountCalculated =
                    state.amountCalculated -
                    step.amountOut.toInt256();
            } else {
                unchecked {
                    state.amountSpecifiedRemaining =
                        state.amountSpecifiedRemaining +
                        step.amountOut.toInt256();
                }

                state.amountCalculated =
                    state.amountCalculated +
                    (step.amountIn + step.feeAmount).toInt256();
            }

            if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
                if (step.initialized) {
                    (, int128 liquidityNet, , , , , , ) = pool.ticks(
                        step.tickNext
                    );

                    unchecked {
                        if (zeroForOne) liquidityNet = -liquidityNet;
                    }

                    state.liquidity = liquidityNet < 0
                        ? state.liquidity - uint128(-liquidityNet)
                        : state.liquidity + uint128(liquidityNet);
                }

                state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
            } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
                state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
            }
        }

        unchecked {
            (int256 amount0, int256 amount1) = zeroForOne == exactInput
                ? (
                    amountSpecified - state.amountSpecifiedRemaining,
                    state.amountCalculated
                )
                : (
                    state.amountCalculated,
                    amountSpecified - state.amountSpecifiedRemaining
                );

            amountOut = uint256(-(zeroForOne ? amount1 : amount0));
        }
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool pool) {
        return IUniswapV3Pool(computePoolAddress(tokenA, tokenB, fee));
    }

    function computePoolAddress(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (address pool) {
        return PoolAddress.computeAddress(factory, tokenA, tokenB, fee);
    }
}
