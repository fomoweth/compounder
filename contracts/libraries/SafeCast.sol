// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library SafeCast {
    error SafeCastFailed();

    function toUint24(int24 x) internal pure returns (uint24) {
        if (int256(x) > int256(uint256(type(uint24).max)))
            revert SafeCastFailed();
        return x >= 0 ? uint24(x) : uint24(-x);
    }

    function toUint128(uint256 x) internal pure returns (uint128 y) {
        if ((y = uint128(x)) != x) revert SafeCastFailed();
    }

    function toUint160(uint256 x) internal pure returns (uint160 y) {
        if ((y = uint160(x)) != x) revert SafeCastFailed();
    }

    function toInt24(uint8 x) internal pure returns (int24 y) {
        if ((y = int24(toInt256(x))) != toInt256(x)) revert SafeCastFailed();
    }

    function toInt256(uint256 x) internal pure returns (int256 y) {
        if (x >= 2 ** 255) revert SafeCastFailed();
        y = int256(x);
    }
}
