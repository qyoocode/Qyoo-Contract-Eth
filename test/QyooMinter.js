import { expect } from "chai";
import {
  MAX_QYOO_ID,
  RANDOM_PRICE,
  CUSTOM_PRICE,
  deploySystemFixture,
  ethers,
  loadFixture,
  makeVoucher,
  networkHelpers,
} from "./helpers.js";

const { time } = networkHelpers;

describe("QyooMinter", function () {
  it("redeems issuer-selected Random and buyer-selected Custom IDs", async function () {
    const { registry, minter, issuer, buyer, otherBuyer } =
      await loadFixture(deploySystemFixture);

    const random = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      tokenId: 4_242_424n,
      tier: 0,
      price: RANDOM_PRICE,
      nonce: 1n,
      resolver: "https://r.qyoo.example/4242424",
    });
    await expect(
      minter.connect(buyer).redeem(random.voucher, random.resolver, random.signature, {
        value: RANDOM_PRICE,
      })
    )
      .to.emit(minter, "VoucherRedeemed")
      .withArgs(
        await minter.hashVoucher(random.voucher),
        4_242_424n,
        buyer.address,
        0,
        RANDOM_PRICE,
        1n
      );

    const custom = await makeVoucher({
      minter,
      issuer,
      recipient: otherBuyer,
      tokenId: MAX_QYOO_ID,
      tier: 1,
      price: CUSTOM_PRICE,
      nonce: 2n,
      resolver: "ipfs://bafy-custom-qyoo",
    });
    await minter.connect(otherBuyer).redeem(custom.voucher, custom.resolver, custom.signature, {
      value: CUSTOM_PRICE,
    });

    expect(await registry.ownerOf(4_242_424n)).to.equal(buyer.address);
    expect(await registry.ownerOf(MAX_QYOO_ID)).to.equal(otherBuyer.address);
  });

  it("rejects underpayment and overpayment with an exact-payment policy", async function () {
    const { minter, issuer, buyer } = await loadFixture(deploySystemFixture);
    const signed = await makeVoucher({ minter, issuer, recipient: buyer });

    await expect(
      minter.connect(buyer).redeem(signed.voucher, signed.resolver, signed.signature, {
        value: RANDOM_PRICE - 1n,
      })
    )
      .to.be.revertedWithCustomError(minter, "IncorrectPayment")
      .withArgs(RANDOM_PRICE, RANDOM_PRICE - 1n);
    await expect(
      minter.connect(buyer).redeem(signed.voucher, signed.resolver, signed.signature, {
        value: RANDOM_PRICE + 1n,
      })
    )
      .to.be.revertedWithCustomError(minter, "IncorrectPayment")
      .withArgs(RANDOM_PRICE, RANDOM_PRICE + 1n);
  });

  it("rejects a signed quote that does not match configured tier pricing", async function () {
    const { minter, issuer, buyer } = await loadFixture(deploySystemFixture);
    const wrongPrice = RANDOM_PRICE - 1n;
    const signed = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      price: wrongPrice,
    });

    await expect(
      minter.connect(buyer).redeem(signed.voucher, signed.resolver, signed.signature, {
        value: wrongPrice,
      })
    )
      .to.be.revertedWithCustomError(minter, "InvalidVoucherPrice")
      .withArgs(RANDOM_PRICE, wrongPrice);
  });

  it("versions price changes so stale vouchers fail and existing tokens are untouched", async function () {
    const { registry, minter, minterOwner, issuer, buyer, otherBuyer } =
      await loadFixture(deploySystemFixture);
    const first = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      tokenId: 100n,
      nonce: 100n,
    });
    await minter.connect(buyer).redeem(first.voucher, first.resolver, first.signature, {
      value: RANDOM_PRICE,
    });
    const stale = await makeVoucher({
      minter,
      issuer,
      recipient: otherBuyer,
      tokenId: 101n,
      nonce: 101n,
    });

    const newRandomPrice = ethers.parseEther("0.02");
    const newCustomPrice = ethers.parseEther("0.2");
    await minter.connect(minterOwner).setPrices(newRandomPrice, newCustomPrice);
    await expect(
      minter.connect(otherBuyer).redeem(stale.voucher, stale.resolver, stale.signature, {
        value: RANDOM_PRICE,
      })
    )
      .to.be.revertedWithCustomError(minter, "InvalidPricingVersion")
      .withArgs(2n, 1n);

    const fresh = await makeVoucher({
      minter,
      issuer,
      recipient: otherBuyer,
      tokenId: 101n,
      nonce: 102n,
      price: newRandomPrice,
      pricingVersion: 2n,
    });
    await minter.connect(otherBuyer).redeem(fresh.voucher, fresh.resolver, fresh.signature, {
      value: newRandomPrice,
    });
    expect(await registry.ownerOf(100n)).to.equal(buyer.address);
    expect(await registry.ownerOf(101n)).to.equal(otherBuyer.address);
  });

  it("prevents voucher replay and nonce reuse", async function () {
    const { minter, issuer, buyer } = await loadFixture(deploySystemFixture);
    const first = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      tokenId: 200n,
      nonce: 7n,
    });
    await minter.connect(buyer).redeem(first.voucher, first.resolver, first.signature, {
      value: RANDOM_PRICE,
    });

    await expect(
      minter.connect(buyer).redeem(first.voucher, first.resolver, first.signature, {
        value: RANDOM_PRICE,
      })
    )
      .to.be.revertedWithCustomError(minter, "NonceAlreadyUsed")
      .withArgs(buyer.address, 7n);

    const altered = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      tokenId: 201n,
      nonce: 7n,
    });
    await expect(
      minter.connect(buyer).redeem(altered.voucher, altered.resolver, altered.signature, {
        value: RANDOM_PRICE,
      })
    ).to.be.revertedWithCustomError(minter, "NonceAlreadyUsed");
  });

  it("binds a voucher to its recipient, resolver, and tier", async function () {
    const { minter, issuer, buyer, attacker } = await loadFixture(deploySystemFixture);
    const signed = await makeVoucher({ minter, issuer, recipient: buyer });

    await expect(
      minter.connect(attacker).redeem(signed.voucher, signed.resolver, signed.signature, {
        value: RANDOM_PRICE,
      })
    )
      .to.be.revertedWithCustomError(minter, "InvalidRecipient")
      .withArgs(buyer.address, attacker.address);
    await expect(
      minter.connect(buyer).redeem(signed.voucher, "https://altered.example", signed.signature, {
        value: RANDOM_PRICE,
      })
    ).to.be.revertedWithCustomError(minter, "InvalidResolverHash");

    const invalidTier = { ...signed.voucher, tier: 2 };
    await expect(
      minter.connect(buyer).redeem(invalidTier, signed.resolver, signed.signature, {
        value: RANDOM_PRICE,
      })
    )
      .to.be.revertedWithCustomError(minter, "InvalidTier")
      .withArgs(2);
  });

  it("rejects expired vouchers", async function () {
    const { minter, issuer, buyer } = await loadFixture(deploySystemFixture);
    const now = await time.latest();
    const signed = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      deadline: BigInt(now + 10),
    });
    await time.increaseTo(now + 11);

    await expect(
      minter.connect(buyer).redeem(signed.voucher, signed.resolver, signed.signature, {
        value: RANDOM_PRICE,
      })
    )
      .to.be.revertedWithCustomError(minter, "ExpiredVoucher")
      .withArgs(BigInt(now + 10));
  });

  it("rejects signatures from another chain, Minter, or signer", async function () {
    const { registry, minter, admin, minterOwner, issuer, treasury, buyer, attacker } =
      await loadFixture(deploySystemFixture);
    const network = await ethers.provider.getNetwork();
    const wrongChain = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      chainId: network.chainId + 1n,
    });
    await expect(
      minter.connect(buyer).redeem(wrongChain.voucher, wrongChain.resolver, wrongChain.signature, {
        value: RANDOM_PRICE,
      })
    ).to.be.revertedWithCustomError(minter, "InvalidSignature");

    const Minter = await ethers.getContractFactory("QyooMinter");
    const secondMinter = await Minter.deploy(
      await registry.getAddress(),
      minterOwner.address,
      issuer.address,
      treasury.address,
      RANDOM_PRICE,
      CUSTOM_PRICE
    );
    await secondMinter.waitForDeployment();
    await registry.connect(admin).setMintAuthority(await secondMinter.getAddress(), true);
    const firstContractSignature = await makeVoucher({ minter, issuer, recipient: buyer });
    await expect(
      secondMinter
        .connect(buyer)
        .redeem(
          firstContractSignature.voucher,
          firstContractSignature.resolver,
          firstContractSignature.signature,
          { value: RANDOM_PRICE }
        )
    ).to.be.revertedWithCustomError(secondMinter, "InvalidSignature");

    const wrongSigner = await makeVoucher({ minter, issuer: attacker, recipient: buyer });
    await expect(
      minter.connect(buyer).redeem(wrongSigner.voucher, wrongSigner.resolver, wrongSigner.signature, {
        value: RANDOM_PRICE,
      })
    ).to.be.revertedWithCustomError(minter, "InvalidSignature");
  });

  it("rejects invalid or already-issued IDs without consuming the voucher nonce", async function () {
    const { registry, minter, admin, issuer, buyer, otherBuyer } =
      await loadFixture(deploySystemFixture);
    const invalid = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      tokenId: 1n << 36n,
      nonce: 300n,
    });
    await expect(
      minter.connect(buyer).redeem(invalid.voucher, invalid.resolver, invalid.signature, {
        value: RANDOM_PRICE,
      })
    ).to.be.revertedWithCustomError(registry, "InvalidQyooId");
    expect(await minter.usedNonces(buyer.address, 300n)).to.equal(false);

    const first = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      tokenId: 301n,
      nonce: 301n,
    });
    await minter.connect(buyer).redeem(first.voucher, first.resolver, first.signature, {
      value: RANDOM_PRICE,
    });
    const duplicate = await makeVoucher({
      minter,
      issuer,
      recipient: otherBuyer,
      tokenId: 301n,
      nonce: 302n,
    });
    await expect(
      minter.connect(otherBuyer).redeem(duplicate.voucher, duplicate.resolver, duplicate.signature, {
        value: RANDOM_PRICE,
      })
    ).to.be.revertedWithCustomError(registry, "QyooAlreadyIssued");
    expect(await minter.usedNonces(otherBuyer.address, 302n)).to.equal(false);

    // Even the Registry admin cannot overwrite the issued token by adding a new minter.
    await registry.connect(admin).setMintAuthority(otherBuyer.address, true);
    await expect(registry.connect(otherBuyer).mint(otherBuyer.address, 301n, "ipfs://overwrite"))
      .to.be.revertedWithCustomError(registry, "QyooAlreadyIssued");
  });

  it("lets operations rotate future issuance keys without changing existing Qyoos", async function () {
    const { registry, minter, minterOwner, issuer, buyer, attacker } =
      await loadFixture(deploySystemFixture);
    const first = await makeVoucher({ minter, issuer, recipient: buyer, tokenId: 401n });
    await minter.connect(buyer).redeem(first.voucher, first.resolver, first.signature, {
      value: RANDOM_PRICE,
    });
    await minter.connect(minterOwner).setAuthorizer(attacker.address);

    const staleSigner = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      tokenId: 402n,
      nonce: 402n,
    });
    await expect(
      minter.connect(buyer).redeem(staleSigner.voucher, staleSigner.resolver, staleSigner.signature, {
        value: RANDOM_PRICE,
      })
    ).to.be.revertedWithCustomError(minter, "InvalidSignature");
    expect(await registry.ownerOf(401n)).to.equal(buyer.address);
    await registry.connect(buyer).setResolver(401n, "ipfs://still-owner-controlled");
  });

  it("pauses commercial minting without pausing existing-holder control", async function () {
    const { registry, minter, minterOwner, issuer, buyer, newHolder } =
      await loadFixture(deploySystemFixture);
    const minted = await makeVoucher({ minter, issuer, recipient: buyer, tokenId: 501n });
    await minter.connect(buyer).redeem(minted.voucher, minted.resolver, minted.signature, {
      value: RANDOM_PRICE,
    });
    await minter.connect(minterOwner).pause();

    const blocked = await makeVoucher({
      minter,
      issuer,
      recipient: buyer,
      tokenId: 502n,
      nonce: 502n,
    });
    await expect(
      minter.connect(buyer).redeem(blocked.voucher, blocked.resolver, blocked.signature, {
        value: RANDOM_PRICE,
      })
    ).to.be.revertedWithCustomError(minter, "EnforcedPause");

    await registry.connect(buyer).setResolver(501n, "https://holder-while-paused.example");
    await registry.connect(buyer).transferFrom(buyer.address, newHolder.address, 501n);
    expect(await registry.ownerOf(501n)).to.equal(newHolder.address);
  });

  it("keeps the Minter owner and compromised Minter unable to seize or redirect", async function () {
    const { registry, minter, admin, minterOwner, issuer, buyer, attacker } =
      await loadFixture(deploySystemFixture);
    const minted = await makeVoucher({ minter, issuer, recipient: buyer, tokenId: 601n });
    await minter.connect(buyer).redeem(minted.voucher, minted.resolver, minted.signature, {
      value: RANDOM_PRICE,
    });
    const minterAddress = await minter.getAddress();

    await expect(registry.connect(admin).setResolver(601n, "https://admin.example"))
      .to.be.revertedWithCustomError(registry, "NotResolverOperator");
    await expect(registry.connect(admin).transferFrom(buyer.address, attacker.address, 601n))
      .to.be.revertedWithCustomError(registry, "ERC721InsufficientApproval");
    await expect(registry.connect(minterOwner).setResolver(601n, "https://minter-owner.example"))
      .to.be.revertedWithCustomError(registry, "NotResolverOperator");
    await expect(
      registry.connect(minterOwner).transferFrom(buyer.address, attacker.address, 601n)
    ).to.be.revertedWithCustomError(registry, "ERC721InsufficientApproval");
    expect(await registry.isMintAuthority(minterAddress)).to.equal(true);
    expect(await registry.ownerOf(601n)).to.equal(buyer.address);
  });

  it("withdraws proceeds explicitly and preserves funds after a failed withdrawal", async function () {
    const { minter, minterOwner, issuer, treasury, buyer } =
      await loadFixture(deploySystemFixture);
    const minted = await makeVoucher({ minter, issuer, recipient: buyer, tokenId: 701n });
    await minter.connect(buyer).redeem(minted.voucher, minted.resolver, minted.signature, {
      value: RANDOM_PRICE,
    });
    const minterAddress = await minter.getAddress();
    expect(await ethers.provider.getBalance(minterAddress)).to.equal(RANDOM_PRICE);

    const Rejector = await ethers.getContractFactory("RejectEtherReceiver");
    const rejector = await Rejector.deploy();
    await rejector.waitForDeployment();
    await minter.connect(minterOwner).setRevenueRecipient(await rejector.getAddress());
    await expect(minter.connect(minterOwner).withdraw())
      .to.be.revertedWithCustomError(minter, "WithdrawalFailed")
      .withArgs(await rejector.getAddress(), RANDOM_PRICE);
    expect(await ethers.provider.getBalance(minterAddress)).to.equal(RANDOM_PRICE);

    await minter.connect(minterOwner).setRevenueRecipient(treasury.address);
    await expect(minter.connect(minterOwner).withdraw())
      .to.emit(minter, "RevenueWithdrawn")
      .withArgs(treasury.address, RANDOM_PRICE);
    expect(await ethers.provider.getBalance(minterAddress)).to.equal(0n);
    await expect(minter.connect(minterOwner).withdraw()).to.be.revertedWithCustomError(
      minter,
      "EmptyBalance"
    );
  });
});
