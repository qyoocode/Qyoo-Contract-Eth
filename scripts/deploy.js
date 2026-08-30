import { network } from "hardhat";

const { ethers } = await network.create();
const [registryAdmin, minterOwner, issuer, treasury] = await ethers.getSigners();

// Illustrative local values only; launch economics are constructor configuration.
const randomPrice = ethers.parseEther("0.01");
const customPrice = ethers.parseEther("0.1");

const registry = await ethers.deployContract("QyooRegistry", [registryAdmin.address]);
await registry.waitForDeployment();

const minter = await ethers.deployContract("QyooMinter", [
  await registry.getAddress(),
  minterOwner.address,
  issuer.address,
  treasury.address,
  randomPrice,
  customPrice,
]);
await minter.waitForDeployment();
await (
  await registry.connect(registryAdmin).setMintAuthority(await minter.getAddress(), true)
).wait();

console.log("Local-only Qyoo deployment");
console.log("Registry:", await registry.getAddress());
console.log("Minter:  ", await minter.getAddress());
console.log("Registry admin:", registryAdmin.address);
console.log("Minter owner:  ", minterOwner.address);
console.log("Issuer:  ", issuer.address);
console.log("Treasury:", treasury.address);
console.log("Minter authorized:", await registry.isMintAuthority(await minter.getAddress()));
