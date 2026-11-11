// Mezo addresses (docs/mezo-reference.md) and small helpers shared by the scripts.
// `T` is picked by --network: mezotestnet (default) or mezomainnet.
const fs = require("fs");
const path = require("path");

const TESTNET = {
  MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  BTC: "0x7b7c000000000000000000000000000000000000",
  BorrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  TroveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  StabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
  PriceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  HintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  SortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  MusdBtcPool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
  mUSDC: "0xe1a26db653708A2AD8F824E92Db9852410e33A59",
  MusdUsdcPool: "0x525F049A4494dA0a6c87E3C4df55f9929765Dc3e",
};

const MAINNET = {
  MUSD: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
  BTC: "0x7b7c000000000000000000000000000000000000",
  BorrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031",
  TroveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
  StabilityPool: "0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32",
  PriceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88",
  HintHelpers: "0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3",
  SortedTroves: "0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f",
  MusdBtcPool: "0x52e604c44417233b6CcEDDDc0d640A405Caacefb",
  mUSDC: "0x04671C72Aab5AC02A03c1098314b1BB6B560c197",
  MusdUsdcPool: "0xEd812AEc0Fecc8fD882Ac3eccC43f3aA80A6c356",
};

const network = require("hardhat").network.name;
const T = network === "mezomainnet" ? MAINNET : TESTNET;

const DEPLOYMENTS = path.join(__dirname, "..", "deployments", `${network === "mezomainnet" ? "mezomainnet" : "mezotestnet"}.json`);
const loadDeployment = () => (fs.existsSync(DEPLOYMENTS) ? JSON.parse(fs.readFileSync(DEPLOYMENTS, "utf8")) : {});
const saveDeployment = (d) => {
  fs.mkdirSync(path.dirname(DEPLOYMENTS), { recursive: true });
  fs.writeFileSync(DEPLOYMENTS, JSON.stringify({ ...loadDeployment(), ...d }, null, 2) + "\n");
};

const ERC20 = ["function balanceOf(address) view returns (uint256)", "function transfer(address,uint256) returns (bool)", "function approve(address,uint256) returns (bool)"];

module.exports = { T, loadDeployment, saveDeployment, ERC20 };
