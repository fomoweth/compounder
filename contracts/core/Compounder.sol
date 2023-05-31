// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/external/Uniswap/V3/INonfungiblePositionManager.sol";
import "../interfaces/external/Uniswap/V3/IUniswapV3Pool.sol";
import "../interfaces/external/token/IERC721Receiver.sol";
import "../interfaces/ICompounder.sol";
import "../interfaces/ISwapper.sol";
import "../libraries/FixedPoint96.sol";
import "../libraries/FullMath.sol";
import "../libraries/LiquidityAmounts.sol";
import "../libraries/PoolAddress.sol";
import "../libraries/SafeCast.sol";
import "../libraries/TickMath.sol";
import "../libraries/TransferHelper.sol";
import "../utils/Ownable.sol";
import "../utils/ReentrancyGuard.sol";

contract Compounder is ICompounder, IERC721Receiver, Ownable, ReentrancyGuard {
    using SafeCast for uint256;
    using TransferHelper for address;

    error EmptyPosition();
    error InsufficientBalance();
    error InvalidNFT();
    error InvalidTokenId();
    error NewOperatorZeroAddress();
    error Restricted();

    mapping(address => mapping(address => uint256)) internal _balances;
    mapping(address => uint256[]) internal _positions;
    mapping(uint256 => address) internal _ownerOf;

    uint256 private constant MAX_UINT256 = type(uint256).max;

    address public immutable WETH;
    address public immutable factory;
    INonfungiblePositionManager public immutable nft;
    ISwapper public immutable swapper;
    address public operator;

    constructor(
        address _weth,
        address _factory,
        address _nft,
        address _swapper
    ) {
        WETH = _weth;
        factory = _factory;
        nft = INonfungiblePositionManager(_nft);
        swapper = ISwapper(_swapper);
    }

    modifier isOwnerOf(uint256 tokenId) {
        if (!_isOwnerOf(tokenId, msg.sender)) revert Restricted();
        _;
    }

    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external returns (bytes4) {
        if (msg.sender != address(nft)) revert InvalidNFT();

        addPosition(tokenId, from);

        return this.onERC721Received.selector;
    }

    function compound(
        uint256 tokenId
    )
        external
        payable
        isOwnerOf(tokenId)
        lock
        returns (uint128 liquidityDelta, uint256 amount0, uint256 amount1)
    {
        address owner = _ownerOf[tokenId];

        (
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            ,
            ,
            ,
            ,

        ) = positions(tokenId);

        (uint256 balance0, uint256 balance1) = nft.collect(
            INonfungiblePositionManager.CollectParams(
                tokenId,
                address(this),
                type(uint128).max,
                type(uint128).max
            )
        );

        unchecked {
            balance0 = balance0 + _balances[owner][token0];
            balance1 = balance1 + _balances[owner][token1];
        }

        (
            uint256 amount0Desired,
            uint256 amount1Desired,
            bool zeroForOne
        ) = computeMintAmountsToRatio(
                token0,
                token1,
                fee,
                tickLower,
                tickUpper,
                balance0,
                balance1
            );

        {
            address tokenIn;
            address tokenOut;
            uint256 amountIn;
            uint256 amountOutMin;

            if (zeroForOne) {
                tokenIn = token0;
                tokenOut = token1;
                amountIn = balance0 - amount0Desired;
                amountOutMin = amount1Desired - balance1;
            } else {
                tokenIn = token1;
                tokenOut = token0;
                amountIn = balance1 - amount1Desired;
                amountOutMin = amount0Desired - balance0;
            }

            if (amountIn != 0 && amountOutMin != 0) {
                swapper.swap(
                    tokenIn,
                    tokenOut,
                    fee,
                    amountIn,
                    amountOutMin,
                    address(this)
                );
            }
        }

        (liquidityDelta, amount0, amount1) = nft.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        _balances[owner][token0] = amount0Desired - amount0;
        _balances[owner][token1] = amount1Desired - amount1;

        emit Compounded(tokenId, liquidityDelta, amount0, amount1);
    }

    function mint(
        MintParams memory params
    )
        external
        payable
        lock
        returns (
            uint256 tokenId,
            uint128 liquidityDelta,
            uint256 amount0,
            uint256 amount1
        )
    {
        approveIfNeeded(params.token0);
        approveIfNeeded(params.token1);

        params.token0.safeTransferFrom(
            msg.sender,
            address(this),
            params.amount0
        );

        params.token1.safeTransferFrom(
            msg.sender,
            address(this),
            params.amount1
        );

        (
            uint256 amount0Desired,
            uint256 amount1Desired,
            bool zeroForOne
        ) = computeMintAmountsToRatio(
                params.token0,
                params.token1,
                params.fee,
                params.tickLower,
                params.tickUpper,
                params.amount0,
                params.amount1
            );

        {
            address tokenIn;
            address tokenOut;
            uint256 amountIn;
            uint256 amountOutMin;

            if (zeroForOne) {
                tokenIn = params.token0;
                tokenOut = params.token1;
                amountIn = params.amount0 - amount0Desired;
                amountOutMin = amount1Desired - params.amount1;
            } else {
                tokenIn = params.token1;
                tokenOut = params.token0;
                amountIn = params.amount1 - amount1Desired;
                amountOutMin = amount0Desired - params.amount0;
            }

            if (amountIn != 0 && amountOutMin != 0) {
                swapper.swap(
                    tokenIn,
                    tokenOut,
                    params.fee,
                    amountIn,
                    amountOutMin,
                    address(this)
                );
            }
        }

        (tokenId, liquidityDelta, amount0, amount1) = nft.mint(
            INonfungiblePositionManager.MintParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: uint256(params.amount0Min),
                amount1Min: uint256(params.amount1Min),
                recipient: address(this),
                deadline: uint256(params.deadline)
            })
        );

        _addPosition(tokenId, msg.sender);

        emit LiquidityAdded(tokenId, liquidityDelta);
    }

    function addLiquidity(
        ModifyPositionParams memory params
    )
        external
        payable
        isOwnerOf(params.tokenId)
        lock
        returns (uint128 liquidityDelta, uint256 amount0, uint256 amount1)
    {
        address owner = _ownerOf[params.tokenId];

        (
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidityPrior,
            ,
            ,
            ,

        ) = positions(params.tokenId);

        token0.safeTransferFrom(msg.sender, address(this), params.amount0);
        token1.safeTransferFrom(msg.sender, address(this), params.amount1);

        (
            uint256 amount0Desired,
            uint256 amount1Desired,
            bool zeroForOne
        ) = computeMintAmountsToRatio(
                token0,
                token1,
                fee,
                tickLower,
                tickUpper,
                params.amount0,
                params.amount1
            );

        {
            address tokenIn;
            address tokenOut;
            uint256 amountIn;
            uint256 amountOutMin;

            if (zeroForOne) {
                tokenIn = token0;
                tokenOut = token1;
                amountIn = params.amount0 - amount0Desired;
                amountOutMin = amount1Desired - params.amount1;
            } else {
                tokenIn = token1;
                tokenOut = token0;
                amountIn = params.amount1 - amount1Desired;
                amountOutMin = amount0Desired - params.amount0;
            }

            if (amountIn != 0 && amountOutMin != 0) {
                swapper.swap(
                    tokenIn,
                    tokenOut,
                    fee,
                    amountIn,
                    amountOutMin,
                    address(this)
                );
            }
        }

        (liquidityDelta, amount0, amount1) = nft.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: params.tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: uint256(params.amount0Min),
                amount1Min: uint256(params.amount1Min),
                deadline: uint256(params.deadline)
            })
        );

        require(liquidityDelta > liquidityPrior);

        _balances[owner][token0] = amount0Desired - amount0;
        _balances[owner][token1] = amount1Desired - amount1;

        emit LiquidityAdded(params.tokenId, liquidityDelta);
    }

    function removeLiquidity(
        ModifyPositionParams memory params
    )
        external
        payable
        isOwnerOf(params.tokenId)
        lock
        returns (uint128 liquidityDelta, uint256 amount0, uint256 amount1)
    {
        (
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidityPrior,
            ,
            ,
            ,

        ) = positions(params.tokenId);

        (uint160 sqrtRatioX96, , , , , , ) = getPool(token0, token1, fee)
            .slot0();

        liquidityDelta = LiquidityAmounts.getLiquidityForAmounts(
            sqrtRatioX96,
            TickMath.getSqrtRatioAtTick(tickLower),
            TickMath.getSqrtRatioAtTick(tickUpper),
            params.amount0,
            params.amount1
        );

        if (liquidityDelta > liquidityPrior) {
            liquidityDelta = liquidityPrior;
        }

        nft.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: params.tokenId,
                liquidity: liquidityDelta,
                amount0Min: uint256(params.amount0Min),
                amount1Min: uint256(params.amount1Min),
                deadline: uint256(params.deadline)
            })
        );

        (amount0, amount1) = nft.collect(
            INonfungiblePositionManager.CollectParams(
                params.tokenId,
                msg.sender,
                type(uint128).max,
                type(uint128).max
            )
        );

        emit LiquidityRemoved(params.tokenId, liquidityDelta);
    }

    function collect(
        uint256 tokenId
    )
        external
        payable
        isOwnerOf(tokenId)
        lock
        returns (uint256 amount0, uint256 amount1)
    {
        (amount0, amount1) = nft.collect(
            INonfungiblePositionManager.CollectParams(
                tokenId,
                msg.sender,
                type(uint128).max,
                type(uint128).max
            )
        );
    }

    function burn(
        uint256 tokenId
    )
        external
        payable
        isOwnerOf(tokenId)
        lock
        returns (uint256 amount0, uint256 amount1)
    {
        (
            ,
            ,
            ,
            ,
            ,
            uint128 liquidity,
            ,
            ,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = positions(tokenId);

        if (liquidity != 0) {
            (uint256 _tokensOwed0, uint256 _tokensOwed1) = nft
                .decreaseLiquidity(
                    INonfungiblePositionManager.DecreaseLiquidityParams({
                        tokenId: tokenId,
                        liquidity: liquidity,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: block.timestamp
                    })
                );

            unchecked {
                tokensOwed0 = tokensOwed0 + uint128(_tokensOwed0);
                tokensOwed1 = tokensOwed1 + uint128(_tokensOwed1);
            }
        }

        if (tokensOwed0 != 0 || tokensOwed1 != 0) {
            (amount0, amount1) = nft.collect(
                INonfungiblePositionManager.CollectParams(
                    tokenId,
                    msg.sender,
                    type(uint128).max,
                    type(uint128).max
                )
            );
        }

        removePosition(tokenId, msg.sender);

        nft.burn(tokenId);

        emit LiquidityRemoved(tokenId, liquidity);
    }

    function withdrawNFT(uint256 tokenId) external isOwnerOf(tokenId) lock {
        removePosition(tokenId, msg.sender);

        nft.safeTransferFrom(address(this), msg.sender, tokenId);
    }

    function withdrawTokens(address token, uint256 amount) external lock {
        uint256 balance = _balances[msg.sender][token];
        if (balance < amount) revert InsufficientBalance();

        _balances[msg.sender][token] = balance - amount;

        token.safeTransfer(msg.sender, amount);

        emit Withdrawal(token, msg.sender, amount);
    }

    function addPosition(uint256 tokenId, address account) internal {
        (address token0, address token1, , , , , , , , ) = positions(tokenId);

        approveIfNeeded(token0);
        approveIfNeeded(token1);

        _addPosition(tokenId, account);
    }

    function _addPosition(uint256 tokenId, address account) private {
        _positions[account].push(tokenId);
        _ownerOf[tokenId] = account;
    }

    function removePosition(uint256 tokenId, address account) internal {
        uint256[] memory cached = _positions[account];
        uint256 length = cached.length;
        uint256 targetIdx = length;

        if (length == 0) revert EmptyPosition();

        for (uint256 i; i < length; ) {
            if (cached[i] == tokenId) {
                targetIdx = i;
                break;
            }

            unchecked {
                i = i + 1;
            }
        }

        if (targetIdx == length) revert InvalidTokenId();

        uint256[] storage tokenIds = _positions[account];
        tokenIds[targetIdx] = tokenIds[tokenIds.length - 1];
        tokenIds.pop();

        delete _ownerOf[tokenId];
    }

    function approveIfNeeded(address token) internal {
        if (token.getAllowance(address(this), address(nft)) != MAX_UINT256) {
            token.tryApprove(address(nft), MAX_UINT256);
            token.tryApprove(address(swapper), MAX_UINT256);
        }
    }

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

    function balanceOf(
        address account,
        address token
    ) external view returns (uint256) {
        return _balances[account][token];
    }

    function getPositions(
        address account
    ) external view returns (uint256[] memory tokenIds) {
        return _positions[account];
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        return _ownerOf[tokenId];
    }

    function positions(
        uint256 tokenId
    )
        internal
        view
        returns (
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        (
            ,
            ,
            token0,
            token1,
            fee,
            tickLower,
            tickUpper,
            liquidity,
            feeGrowthInside0LastX128,
            feeGrowthInside1LastX128,
            tokensOwed0,
            tokensOwed1
        ) = nft.positions(tokenId);
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool pool) {
        return
            IUniswapV3Pool(
                PoolAddress.computeAddress(factory, tokenA, tokenB, fee)
            );
    }

    function _isOwnerOf(
        uint256 tokenId,
        address account
    ) private view returns (bool) {
        return _ownerOf[tokenId] == account;
    }
}
