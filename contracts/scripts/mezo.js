// Mezo testnet addresses (docs/mezo-reference.md) and small helpers shared by the scripts.
const fs = require("fs");
const path = require("path");

const T = {
  MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  BTC: "0x7b7c000000000000000000000000000000000000",
  BorrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  TroveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  StabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
  PriceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  HintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  SortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  MusdBtcPool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
};

const DEPLOYMENTS = path.join(__dirname, "..", "deployments", "mezotestnet.json");
const loadDeployment = () => (fs.existsSync(DEPLOYMENTS) ? JSON.parse(fs.readFileSync(DEPLOYMENTS, "utf8")) : {});
const saveDeployment = (d) => {
  fs.mkdirSync(path.dirname(DEPLOYMENTS), { recursive: true });
  fs.writeFileSync(DEPLOYMENTS, JSON.stringify({ ...loadDeployment(), ...d }, null, 2) + "\n");
};

const ERC20 = ["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)", "function approve(address,uint256) returns (bool)"];

module.exports = { T, loadDeployment, saveDeployment, ERC20 };
