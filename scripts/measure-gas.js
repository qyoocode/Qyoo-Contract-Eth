import { network } from "hardhat";
import { signMintVoucher } from "./lib/vouchers.js";

const { ethers } = await network.create();
const [
  registryAdmin,
  minterOwner,
  issuer,
  treasury,
  randomBuyer,
  customBuyer,
  controller,
  newOwner,
] = await ethers.getSigners();
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

async function redeemAndMeasure({ buyer, tokenId, tier, price, nonce, resolver }) {
  const signed = await signMintVoucher({
    ethers,
    minter,
    issuer,
    tokenId,
    recipient: buyer,
    tier,
    price,
    nonce,
    resolver,
  });
  const receipt = await (
    await minter.connect(buyer).redeem(signed.voucher, resolver, signed.signature, { value: price })
  ).wait();
  return receipt.gasUsed;
}

const randomId = 1001n;
const customId = 10_000_000_001n;
const measurements = {};
measurements.randomVoucherMint = await redeemAndMeasure({
  buyer: randomBuyer,
  tokenId: randomId,
  tier: 0,
  price: randomPrice,
  nonce: 1n,
  resolver: "https://r.qyoo.example/v1/1001",
});
measurements.customVoucherMint = await redeemAndMeasure({
  buyer: customBuyer,
  tokenId: customId,
  tier: 1,
  price: customPrice,
  nonce: 2n,
  resolver: "ipfs://bafy-custom-10000000001",
});
measurements.controllerUpdate = (
  await (await registry.connect(randomBuyer).setController(randomId, controller.address)).wait()
).gasUsed;
measurements.resolverUpdate = (
  await (await registry.connect(controller).setResolver(randomId, "ipfs://bafy-updated")).wait()
).gasUsed;
measurements.erc721Transfer = (
  await (
    await registry
      .connect(randomBuyer)
      .transferFrom(randomBuyer.address, newOwner.address, randomId)
  ).wait()
).gasUsed;

console.log("Approximate local Hardhat gas (Solidity 0.8.26, optimizer 200, Cancun)");
for (const [operation, gasUsed] of Object.entries(measurements)) {
  console.log(`${operation}: ${gasUsed.toString()}`);
}
