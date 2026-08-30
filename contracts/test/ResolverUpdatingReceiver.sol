// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {QyooRegistry} from "../QyooRegistry.sol";

contract ResolverUpdatingReceiver is IERC721Receiver {
    QyooRegistry private immutable _registry;
    string private _resolver;

    constructor(QyooRegistry registry_, string memory resolver_) {
        _registry = registry_;
        _resolver = resolver_;
    }

    function onERC721Received(
        address,
        address,
        uint256 tokenId,
        bytes calldata
    ) external returns (bytes4) {
        _registry.setResolver(tokenId, _resolver);
        return IERC721Receiver.onERC721Received.selector;
    }
}
