import { expect } from "chai";
import {
  MAX_QYOO_ID,
  deployRegistryFixture,
  ethers,
  loadFixture,
} from "./helpers.js";

describe("QyooRegistry", function () {
  const resolver = "https://resolver.example/qyoo/1234";

  it("makes the exact scanned 36-bit value the ERC-721 token ID", async function () {
    const { registry, mintAuthority, holder } = await loadFixture(deployRegistryFixture);

    await expect(registry.connect(mintAuthority).mint(holder.address, 1234n, resolver))
      .to.emit(registry, "QyooMinted")
      .withArgs(1234n, holder.address, mintAuthority.address, resolver);

    expect(await registry.ownerOf(1234n)).to.equal(holder.address);
    expect(await registry.resolverOf(1234n)).to.equal(resolver);
    expect(await registry.wasIssued(1234n)).to.equal(true);
  });

  it("accepts the complete carrier boundary and rejects 2**36", async function () {
    const { registry, mintAuthority, holder } = await loadFixture(deployRegistryFixture);
    for (const tokenId of [0n, 1n, 34_359_738_368n, MAX_QYOO_ID]) {
      await registry.connect(mintAuthority).mint(holder.address, tokenId, `ipfs://qyoo-${tokenId}`);
      expect(await registry.ownerOf(tokenId)).to.equal(holder.address);
    }

    await expect(
      registry.connect(mintAuthority).mint(holder.address, 1n << 36n, resolver)
    )
      .to.be.revertedWithCustomError(registry, "InvalidQyooId")
      .withArgs(1n << 36n);
  });

  it("rejects unauthorized, duplicate, empty, and oversized resolution state", async function () {
    const { registry, mintAuthority, holder, attacker } = await loadFixture(deployRegistryFixture);

    await expect(registry.connect(attacker).mint(holder.address, 10n, resolver))
      .to.be.revertedWithCustomError(registry, "NotMintAuthority")
      .withArgs(attacker.address);
    await expect(registry.connect(mintAuthority).mint(holder.address, 10n, ""))
      .to.be.revertedWithCustomError(registry, "ResolverEmpty");
    const oversized = `https://${"x".repeat(250)}`;
    await expect(registry.connect(mintAuthority).mint(holder.address, 10n, oversized))
      .to.be.revertedWithCustomError(registry, "ResolverTooLong")
      .withArgs(oversized.length);

    await registry.connect(mintAuthority).mint(holder.address, 10n, resolver);
    await expect(registry.connect(mintAuthority).mint(attacker.address, 10n, "ipfs://replacement"))
      .to.be.revertedWithCustomError(registry, "QyooAlreadyIssued")
      .withArgs(10n);
  });

  it("lets only the token owner appoint or revoke a controller", async function () {
    const { registry, mintAuthority, holder, controller, attacker } =
      await loadFixture(deployRegistryFixture);
    await registry.connect(mintAuthority).mint(holder.address, 22n, resolver);

    await expect(registry.connect(attacker).setController(22n, attacker.address))
      .to.be.revertedWithCustomError(registry, "NotQyooOwner")
      .withArgs(attacker.address, 22n);
    await registry.connect(holder).setController(22n, controller.address);
    expect(await registry.controllerOf(22n)).to.equal(controller.address);

    await registry.connect(holder).setController(22n, ethers.ZeroAddress);
    expect(await registry.controllerOf(22n)).to.equal(ethers.ZeroAddress);
    await expect(registry.connect(controller).setResolver(22n, "ipfs://revoked"))
      .to.be.revertedWithCustomError(registry, "NotResolverOperator")
      .withArgs(controller.address, 22n);
  });

  it("lets owner or controller change only the resolver, never ownership", async function () {
    const { registry, mintAuthority, holder, controller, newHolder, attacker } =
      await loadFixture(deployRegistryFixture);
    await registry.connect(mintAuthority).mint(holder.address, 33n, resolver);
    await registry.connect(holder).setController(33n, controller.address);

    await registry.connect(controller).setResolver(33n, "ipfs://controller-update");
    expect(await registry.resolverOf(33n)).to.equal("ipfs://controller-update");
    await expect(registry.connect(controller).transferFrom(holder.address, newHolder.address, 33n))
      .to.be.revertedWithCustomError(registry, "ERC721InsufficientApproval")
      .withArgs(controller.address, 33n);
    await expect(registry.connect(attacker).setResolver(33n, "https://attacker.example"))
      .to.be.revertedWithCustomError(registry, "NotResolverOperator");

    await registry.connect(holder).setResolver(33n, "ar://owner-update");
    expect(await registry.resolverOf(33n)).to.equal("ar://owner-update");
  });

  it("clears a delegated controller automatically on ownership transfer", async function () {
    const { registry, mintAuthority, holder, controller, newHolder } =
      await loadFixture(deployRegistryFixture);
    await registry.connect(mintAuthority).mint(holder.address, 44n, resolver);
    await registry.connect(holder).setController(44n, controller.address);

    await expect(registry.connect(holder).transferFrom(holder.address, newHolder.address, 44n))
      .to.emit(registry, "ControllerChanged")
      .withArgs(44n, controller.address, ethers.ZeroAddress, holder.address);
    expect(await registry.ownerOf(44n)).to.equal(newHolder.address);
    expect(await registry.controllerOf(44n)).to.equal(ethers.ZeroAddress);
    await expect(registry.connect(controller).setResolver(44n, "https://stale-controller.example"))
      .to.be.revertedWithCustomError(registry, "NotResolverOperator");
    await registry.connect(newHolder).setResolver(44n, "https://new-owner.example");
  });

  it("keeps ordinary ERC-721 transfers interoperable while separating protocol control", async function () {
    const { registry, mintAuthority, holder, newHolder, attacker } =
      await loadFixture(deployRegistryFixture);
    await registry.connect(mintAuthority).mint(holder.address, 55n, resolver);
    await registry.connect(holder).approve(attacker.address, 55n);

    await expect(registry.connect(attacker).setResolver(55n, "https://operator.example"))
      .to.be.revertedWithCustomError(registry, "NotResolverOperator");
    await expect(registry.connect(attacker).setController(55n, attacker.address))
      .to.be.revertedWithCustomError(registry, "NotQyooOwner");
    await registry.connect(attacker).transferFrom(holder.address, newHolder.address, 55n);
    expect(await registry.ownerOf(55n)).to.equal(newHolder.address);
  });

  it("does not grant the Registry admin any existing-token back door", async function () {
    const { registry, admin, mintAuthority, holder, newHolder } =
      await loadFixture(deployRegistryFixture);
    await registry.connect(mintAuthority).mint(holder.address, 66n, resolver);

    await expect(registry.connect(admin).transferFrom(holder.address, newHolder.address, 66n))
      .to.be.revertedWithCustomError(registry, "ERC721InsufficientApproval");
    await expect(registry.connect(admin).setResolver(66n, "https://admin.example"))
      .to.be.revertedWithCustomError(registry, "NotResolverOperator");
    await expect(registry.connect(admin).setController(66n, admin.address))
      .to.be.revertedWithCustomError(registry, "NotQyooOwner");
  });

  it("limits mint-authority privilege to previously unused IDs", async function () {
    const { registry, admin, mintAuthority, holder, controller, attacker } =
      await loadFixture(deployRegistryFixture);
    await registry.connect(mintAuthority).mint(holder.address, 77n, resolver);

    await expect(registry.connect(mintAuthority).setResolver(77n, "https://minter.example"))
      .to.be.revertedWithCustomError(registry, "NotResolverOperator");
    await expect(registry.connect(mintAuthority).setController(77n, controller.address))
      .to.be.revertedWithCustomError(registry, "NotQyooOwner");
    await expect(registry.connect(mintAuthority).transferFrom(holder.address, attacker.address, 77n))
      .to.be.revertedWithCustomError(registry, "ERC721InsufficientApproval");

    await registry.connect(admin).setMintAuthority(mintAuthority.address, false);
    await expect(registry.connect(mintAuthority).mint(attacker.address, 78n, resolver))
      .to.be.revertedWithCustomError(registry, "NotMintAuthority");
  });

  it("pauses only new issuance, not holder transfer or resolver control", async function () {
    const { registry, admin, mintAuthority, holder, controller, newHolder } =
      await loadFixture(deployRegistryFixture);
    await registry.connect(mintAuthority).mint(holder.address, 88n, resolver);
    await registry.connect(holder).setController(88n, controller.address);
    await registry.connect(admin).setMintingPaused(true);

    await expect(registry.connect(mintAuthority).mint(holder.address, 89n, resolver))
      .to.be.revertedWithCustomError(registry, "MintingPaused");
    await registry.connect(controller).setResolver(88n, "ipfs://while-paused");
    await registry.connect(holder).transferFrom(holder.address, newHolder.address, 88n);
    await registry.connect(newHolder).setResolver(88n, "https://new-owner-while-paused.example");
    expect(await registry.ownerOf(88n)).to.equal(newHolder.address);
  });

  it("exposes complete read-only resolution state and no public burn function", async function () {
    const { registry, mintAuthority, holder, controller } =
      await loadFixture(deployRegistryFixture);
    await registry.connect(mintAuthority).mint(holder.address, 99n, resolver);
    await registry.connect(holder).setController(99n, controller.address);

    const state = await registry.resolutionOf(99n);
    expect(state.tokenOwner).to.equal(holder.address);
    expect(state.controller).to.equal(controller.address);
    expect(state.resolver).to.equal(resolver);
    expect(registry.interface.fragments.some((fragment) => fragment.name === "burn")).to.equal(false);
  });

  it("keeps event reconstruction ordered across a safe-mint receiver callback", async function () {
    const { registry, mintAuthority } = await loadFixture(deployRegistryFixture);
    const callbackResolver = "ipfs://receiver-callback";
    const Receiver = await ethers.getContractFactory("ResolverUpdatingReceiver");
    const receiver = await Receiver.deploy(await registry.getAddress(), callbackResolver);
    await receiver.waitForDeployment();

    const receipt = await (
      await registry.connect(mintAuthority).mint(await receiver.getAddress(), 111n, resolver)
    ).wait();
    const resolverEvents = receipt.logs
      .map((log) => {
        try {
          return registry.interface.parseLog(log);
        } catch {
          return undefined;
        }
      })
      .filter((event) => event?.name === "ResolverChanged");

    expect(resolverEvents).to.have.length(2);
    expect(resolverEvents[0].args.previousResolver).to.equal("");
    expect(resolverEvents[0].args.newResolver).to.equal(resolver);
    expect(resolverEvents[1].args.previousResolver).to.equal(resolver);
    expect(resolverEvents[1].args.newResolver).to.equal(callbackResolver);
    expect(await registry.resolverOf(111n)).to.equal(callbackResolver);
  });
});
