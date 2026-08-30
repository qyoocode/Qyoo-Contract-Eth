import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const { loadFixture } = networkHelpers;

const MAX_QYOO_ID = (1n << 36n) - 1n;
const RANDOM_PRICE = ethers.parseEther("0.01");
const CUSTOM_PRICE = ethers.parseEther("0.1");

const voucherTypes = {
  MintVoucher: [
    { name: "tokenId", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "tier", type: "uint8" },
    { name: "price", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "pricingVersion", type: "uint256" },
    { name: "resolverHash", type: "bytes32" },
  ],
};

async function deployRegistryFixture() {
  const [admin, mintAuthority, holder, controller, newHolder, attacker, treasury, issuer] =
    await ethers.getSigners();
  const Registry = await ethers.getContractFactory("QyooRegistry");
  const registry = await Registry.deploy(admin.address);
  await registry.waitForDeployment();
  await registry.connect(admin).setMintAuthority(mintAuthority.address, true);

  return {
    registry,
    admin,
    mintAuthority,
    holder,
    controller,
    newHolder,
    attacker,
    treasury,
    issuer,
  };
}

async function deploySystemFixture() {
  const [
    admin,
    minterOwner,
    issuer,
    treasury,
    buyer,
    controller,
    newHolder,
    attacker,
    otherBuyer,
  ] = await ethers.getSigners();

  const Registry = await ethers.getContractFactory("QyooRegistry");
  const registry = await Registry.deploy(admin.address);
  await registry.waitForDeployment();

  const Minter = await ethers.getContractFactory("QyooMinter");
  const minter = await Minter.deploy(
    await registry.getAddress(),
    minterOwner.address,
    issuer.address,
    treasury.address,
    RANDOM_PRICE,
    CUSTOM_PRICE
  );
  await minter.waitForDeployment();
  await registry.connect(admin).setMintAuthority(await minter.getAddress(), true);

  return {
    registry,
    minter,
    admin,
    minterOwner,
    issuer,
    treasury,
    buyer,
    controller,
    newHolder,
    attacker,
    otherBuyer,
  };
}

async function makeVoucher({
  minter,
  issuer,
  recipient,
  tokenId = 1234n,
  tier = 0,
  price = RANDOM_PRICE,
  nonce = 1n,
  deadline,
  pricingVersion = 1n,
  resolver = "https://resolver.qyoo.example/v1/1234",
  chainId,
  verifyingContract,
}) {
  const network = await ethers.provider.getNetwork();
  const currentBlock = await ethers.provider.getBlock("latest");
  const effectiveDeadline = deadline ?? BigInt(currentBlock.timestamp + 3600);
  const voucher = {
    tokenId,
    recipient: recipient.address ?? recipient,
    tier,
    price,
    nonce,
    deadline: effectiveDeadline,
    pricingVersion,
    resolverHash: ethers.keccak256(ethers.toUtf8Bytes(resolver)),
  };
  const domain = {
    name: "QyooMinter",
    version: "1",
    chainId: chainId ?? network.chainId,
    verifyingContract: verifyingContract ?? (await minter.getAddress()),
  };
  const signature = await issuer.signTypedData(domain, voucherTypes, voucher);
  return { voucher, resolver, signature, domain };
}

export {
  MAX_QYOO_ID,
  RANDOM_PRICE,
  CUSTOM_PRICE,
  ethers,
  networkHelpers,
  voucherTypes,
  deployRegistryFixture,
  deploySystemFixture,
  loadFixture,
  makeVoucher,
};
