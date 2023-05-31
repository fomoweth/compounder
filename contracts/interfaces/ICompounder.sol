// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./external/token/IERC721Receiver.sol";

interface ICompounder {
    event Compounded(
        uint256 indexed tokenId,
        uint128 indexed liquidityDelta,
        uint256 amount0,
        uint256 amount1
    );

    event LiquidityAdded(
        uint256 indexed tokenId,
        uint128 indexed liquidityDelta
    );

    event LiquidityRemoved(
        uint256 indexed tokenId,
        uint128 indexed liquidityDelta
    );

    event Withdrawal(
        address indexed token,
        address indexed account,
        uint256 indexed amount
    );

    function compound(
        uint256 tokenId
    )
        external
        payable
        returns (uint128 liquidityDelta, uint256 amount0, uint256 amount1);

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 amount0;
        uint128 amount1;
        uint112 amount0Min;
        uint112 amount1Min;
        uint32 deadline;
    }

    function mint(
        MintParams memory params
    )
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidityDelta,
            uint256 amount0,
            uint256 amount1
        );

    struct ModifyPositionParams {
        uint256 tokenId;
        uint128 amount0;
        uint128 amount1;
        uint112 amount0Min;
        uint112 amount1Min;
        uint32 deadline;
    }

    function addLiquidity(
        ModifyPositionParams memory params
    )
        external
        payable
        returns (uint128 liquidityDelta, uint256 amount0, uint256 amount1);

    function removeLiquidity(
        ModifyPositionParams memory params
    )
        external
        payable
        returns (uint128 liquidityDelta, uint256 amount0, uint256 amount1);

    function collect(
        uint256 tokenId
    ) external payable returns (uint256 amount0, uint256 amount1);

    function burn(
        uint256 tokenId
    ) external payable returns (uint256 amount0, uint256 amount1);

    function getPositions(
        address account
    ) external view returns (uint256[] memory tokenIds);

    function ownerOf(uint256 tokenId) external view returns (address owner);

    function balanceOf(
        address account,
        address token
    ) external view returns (uint256);
}
