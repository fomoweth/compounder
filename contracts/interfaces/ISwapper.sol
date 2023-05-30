// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISwapper {
    function swap(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external payable returns (uint256 amountOut);

    function quote(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}
