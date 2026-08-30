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

const randomId = 424_242n;
const customId = 9_876_543_210n;
const randomResolver = `https://r.qyoo.example/v1/${randomId}`;
const customResolver = `ipfs://bafy-demo-${customId}`;

const randomVoucher = await signMintVoucher({
  ethers,
  minter,
  issuer,
  tokenId: randomId,
  recipient: randomBuyer,
  tier: 0,
  price: randomPrice,
  nonce: 1n,
  resolver: randomResolver,
});
await (
  await minter
    .connect(randomBuyer)
    .redeem(randomVoucher.voucher, randomResolver, randomVoucher.signature, {
      value: randomPrice,
    })
).wait();

const customVoucher = await signMintVoucher({
  ethers,
  minter,
  issuer,
  tokenId: customId,
  recipient: customBuyer,
  tier: 1,
  price: customPrice,
  nonce: 2n,
  resolver: customResolver,
});
await (
  await minter
    .connect(customBuyer)
    .redeem(customVoucher.voucher, customResolver, customVoucher.signature, {
      value: customPrice,
    })
).wait();

await (await registry.connect(randomBuyer).setController(randomId, controller.address)).wait();
await (
  await registry.connect(controller).setResolver(randomId, "ipfs://controller-managed-demo")
).wait();
await (await registry.connect(randomBuyer).setController(randomId, ethers.ZeroAddress)).wait();

// Reappoint to prove that a later ownership transfer clears the delegation.
await (await registry.connect(randomBuyer).setController(randomId, controller.address)).wait();
await (
  await registry
    .connect(randomBuyer)
    .transferFrom(randomBuyer.address, newOwner.address, randomId)
).wait();

let oldControllerRejected = false;
try {
  await (
    await registry.connect(controller).setResolver(randomId, "https://stale-controller.example")
  ).wait();
} catch {
  oldControllerRejected = true;
}
if (!oldControllerRejected) throw new Error("Old controller unexpectedly retained authority");

await (
  await registry.connect(newOwner).setResolver(randomId, "ar://new-owner-diorama")
).wait();

const randomState = await registry.resolutionOf(randomId);
const customState = await registry.resolutionOf(customId);
console.log("Qyoo local protocol demo complete");
console.log("Registry:", await registry.getAddress());
console.log("Minter:  ", await minter.getAddress());
console.log("Random Qyoo ID:", randomId.toString());
console.log("Random owner:", randomState.tokenOwner);
console.log("Random controller after transfer:", randomState.controller);
console.log("Random resolver:", randomState.resolver);
console.log("Custom Qyoo ID:", customId.toString());
console.log("Custom owner:", customState.tokenOwner);
console.log("Custom resolver:", customState.resolver);
console.log("Old controller update rejected:", oldControllerRejected);
console.log("Mint proceeds retained for withdrawal:", ethers.formatEther(await ethers.provider.getBalance(await minter.getAddress())), "ETH");
