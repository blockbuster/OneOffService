const FakeUSD = artifacts.require("FakeUSD");
const OneOffService = artifacts.require("OneOffService");

module.exports = function (deployer, network) {
    if (network === "develop" || network === "goerli") {
        deployer.deploy(FakeUSD, 1000).then(function () {
            return deployer.deploy(
                OneOffService,
                FakeUSD.address, // USDT Address
                '0xf179Ca53Fa141c271Ddb150EF4845b390d869259', // contractor
                '0x926DbcCA18403a626Cf83397B95c7F817B36a05D', // inspector
                1000, // service cost
                14,   // days until the deadline
                100,  // penalty, USDT per day of delay
            )
        });
    } else if (network === "live") {
        return deployer.deploy(
            OneOffService,
            '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Real USDT Address
            '0xf179Ca53Fa141c271Ddb150EF4845b390d869259', // contractor
            '0x926DbcCA18403a626Cf83397B95c7F817B36a05D', // inspector
            1000, // service cost
            14,   // days until the deadline
            100,  // penalty, USDT per day of delay
        )
    }
};
