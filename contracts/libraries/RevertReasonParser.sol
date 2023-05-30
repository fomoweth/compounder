// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./StringUtil.sol";

library RevertReasonParser {
    using StringUtil for bytes;
    using StringUtil for uint256;

    error InvalidRevertReason();

    bytes4 private constant ERROR_SELECTOR = bytes4(keccak256("Error(string)"));
    bytes4 private constant PANIC_SELECTOR =
        bytes4(keccak256("Panic(uint256)"));

    function parse(bytes memory data) internal pure returns (string memory) {
        return parse(data, "");
    }

    function parse(
        bytes memory data,
        string memory prefix
    ) internal pure returns (string memory) {
        bytes4 selector;
        if (data.length >= 4) {
            assembly {
                selector := mload(add(data, 0x20))
            }
        }

        if (selector == ERROR_SELECTOR && data.length >= 68) {
            string memory reason;
            assembly {
                reason := add(data, 68)
            }

            if (data.length >= 68 + bytes(reason).length) {
                return string.concat(prefix, "Error(", reason, ")");
            }
        } else if (selector == PANIC_SELECTOR && data.length == 36) {
            uint256 code;
            assembly {
                code := mload(add(data, 36))
            }
            return string.concat(prefix, "Panic(", code.toHex(), ")");
        }
        return string.concat(prefix, "Unknown(", data.toHex(), ")");
    }

    function reRevert() internal pure {
        assembly {
            let ptr := mload(0x40)
            returndatacopy(ptr, 0, returndatasize())
            revert(ptr, returndatasize())
        }
    }
}
