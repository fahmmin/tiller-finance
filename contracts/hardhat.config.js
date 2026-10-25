require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.28",
    // Mezo docs pin london (no PUSH0)
    settings: { evmVersion: "london", optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    mezotestnet: { url: "https://rpc.test.mezo.org", chainId: 31611, accounts },
  },
};
