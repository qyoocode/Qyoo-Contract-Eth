export const voucherTypes = {
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

export async function signMintVoucher({
  ethers,
  minter,
  issuer,
  tokenId,
  recipient,
  tier,
  price,
  nonce,
  resolver,
}) {
  const network = await ethers.provider.getNetwork();
  const block = await ethers.provider.getBlock("latest");
  const voucher = {
    tokenId,
    recipient: recipient.address ?? recipient,
    tier,
    price,
    nonce,
    deadline: BigInt(block.timestamp + 3600),
    pricingVersion: await minter.pricingVersion(),
    resolverHash: ethers.keccak256(ethers.toUtf8Bytes(resolver)),
  };
  const domain = {
    name: "QyooMinter",
    version: "1",
    chainId: network.chainId,
    verifyingContract: await minter.getAddress(),
  };
  const signature = await issuer.signTypedData(domain, voucherTypes, voucher);
  return { voucher, signature };
}
