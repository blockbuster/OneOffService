// SPDX-License-Identifier: MIT
// Tells the Solidity compiler to compile only from v0.8.13 to v0.9.0
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FakeUSD is ERC20 {
    constructor(uint256 _initialMint) ERC20("Fake USD", "FUSD") {
        _mint(msg.sender, _initialMint);
    }
}
