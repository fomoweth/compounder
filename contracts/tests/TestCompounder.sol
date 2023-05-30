// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../core/Compounder.sol";

contract TestCompounder is Compounder {
    using TransferHelper for address;

    constructor(
        address _weth,
        address _factory,
        address _nft,
        address _swapper
    ) Compounder(_weth, _factory, _nft, _swapper) {}

    function updateBalance(
        address token,
        address account,
        uint256 amount
    ) public {
        token.safeTransferFrom(account, address(this), amount);

        _balances[account][token] = amount;
    }

    function getMintAmountsToRatio(
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    )
        external
        view
        returns (uint256 amount0, uint256 amount1, bool zeroForOne)
    {
        return
            computeMintAmountsToRatio(
                token0,
                token1,
                fee,
                tickLower,
                tickUpper,
                amount0Desired,
                amount1Desired
            );
    }
}
