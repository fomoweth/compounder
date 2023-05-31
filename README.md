# Compounder

Optimizer for compounding the Uniswap V3 LP positions with accrued fees.

## Installation

```bash
git clone https://github.com/fomoweth/compounder

cd compounder

npm install
```

## Usage

Create an environment file `.env` with the following content:

```text
INFURA_API_KEY=YOUR_INFURA_API_KEY
CMC_API_KEY=YOUR_COIN_MARKET_CAP_API_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
MNEMONIC=YOUR_MNEMONIC (Optional)
FORK_BLOCK_NUMBER=17368595 (Optional)
ENABLE_GAS_REPORT=(true || false) (Optional)
```

Then you can compile the contracts:

```bash
# compile contracts to generate artifacts and typechain-types
npm run compile

# remove the generated artifacts and typechain-types
npm run clean

# clean and compile
npm run build
```

## Test

```bash
# to run the integration tests
npm test
```

## Contract Integration

The Uniswap V3 LP position minted and stored in the Compounder contract can be compounded by calling the function below.

```solidity

function compound(uint256 tokenId) external payable
	returns (uint128 liquidityDelta, uint256 amount0, uint256 amount1);

```

The Compounder contract computes the amounts of the tokens to be minted with the following function, then it defines the optimal amount of tokens to swap.

```solidity

function computeMintAmountsToRatio(
	address token0,
	address token1,
	uint24 fee,
	int24 tickLower,
	int24 tickUpper,
	uint256 amount0Desired,
	uint256 amount1Desired
)
	internal
	view
	returns (uint256 amount0, uint256 amount1, bool zeroForOne)
{
	amount0 = amount0Desired;
	amount1 = amount1Desired;

	(uint160 sqrtRatioX96, , , , , , ) = getPool(token0, token1, fee)
		.slot0();

	uint256 ratioX96 = (uint256(sqrtRatioX96) * (sqrtRatioX96)) /
		FixedPoint96.Q96;

	(uint256 mintAmount0, uint256 mintAmount1) = LiquidityAmounts
		.getAmountsForLiquidity(
			sqrtRatioX96,
			TickMath.getSqrtRatioAtTick(tickLower),
			TickMath.getSqrtRatioAtTick(tickUpper),
			FixedPoint96.Q96.toUint128()
		);

	uint256 amount0Delta;

	if (mintAmount0 == 0) {
		amount0Delta = amount0;
		zeroForOne = true;
	} else if (mintAmount1 == 0) {
		amount0Delta = FullMath.mulDiv(amount1, FixedPoint96.Q96, ratioX96);
		zeroForOne = false;
	} else {
		uint256 amountRatioX96 = FullMath.mulDiv(
			mintAmount0,
			FixedPoint96.Q96,
			mintAmount1
		);

		zeroForOne = amountRatioX96 * amount1 < amount0 * FixedPoint96.Q96;

		uint256 numerator = zeroForOne
			? amount0 * FixedPoint96.Q96 - amountRatioX96 * amount1
			: amountRatioX96 * amount1 - amount0 * FixedPoint96.Q96;

		uint256 denominator = FullMath.mulDiv(
			amountRatioX96,
			ratioX96,
			FixedPoint96.Q96
		) + FixedPoint96.Q96;

		amount0Delta = numerator / denominator;
	}

	if (amount0Delta != 0) {
		uint256 amountOut;

		if (zeroForOne) {
			amountOut = ISwapper(swapper).quote(
				token0,
				token1,
				fee,
				amount0Delta
			);

			amount0 = amount0 - amount0Delta;
			amount1 = amount1 + amountOut;
		} else {
			uint256 amount1Delta = FullMath.mulDiv(
				amount0Delta,
				ratioX96,
				FixedPoint96.Q96
			);
			amountOut = ISwapper(swapper).quote(
				token1,
				token0,
				fee,
				amount1Delta
			);

			amount0 = amount0 + amountOut;
			amount1 = amount1 - amount1Delta;
		}
	}
}

```

The Swapper contract can compute the expected amount of tokens in return with the following function which returns the same value with the Quoter V2 contract of Uniswap V3 via static-call.

```solidity

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

```
