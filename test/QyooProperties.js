import { expect } from "chai";
import {
  MAX_QYOO_ID,
  deployRegistryFixture,
  ethers,
  loadFixture,
} from "./helpers.js";

describe("Qyoo protocol properties", function () {
  it("never creates the same deterministic fuzzed ID twice", async function () {
    const { registry, mintAuthority, holder, attacker } =
      await loadFixture(deployRegistryFixture);
    let state = 0x5eed_1234_9876n;
    const seen = new Set();

    for (let index = 0; index < 40; index += 1) {
      // Deterministic 64-bit LCG, then constrain to the carrier namespace.
      state = (state * 6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n) &
        ((1n << 64n) - 1n);
      const tokenId = state & MAX_QYOO_ID;
      if (seen.has(tokenId.toString())) continue;
      seen.add(tokenId.toString());

      await registry.connect(mintAuthority).mint(holder.address, tokenId, `ipfs://fuzz-${tokenId}`);
      await expect(
        registry.connect(mintAuthority).mint(attacker.address, tokenId, `ipfs://reuse-${tokenId}`)
      )
        .to.be.revertedWithCustomError(registry, "QyooAlreadyIssued")
        .withArgs(tokenId);
      expect(await registry.ownerOf(tokenId)).to.equal(holder.address);
      expect(await registry.wasIssued(tokenId)).to.equal(true);
    }
    expect(seen.size).to.be.greaterThan(30);
  });

  it("rejects representative fuzzed values outside the 36-bit namespace", async function () {
    const { registry, mintAuthority, holder } = await loadFixture(deployRegistryFixture);
    for (let offset = 1n; offset <= 32n; offset += 1n) {
      const invalidId = MAX_QYOO_ID + offset * 7919n;
      await expect(
        registry.connect(mintAuthority).mint(holder.address, invalidId, "ipfs://invalid")
      )
        .to.be.revertedWithCustomError(registry, "InvalidQyooId")
        .withArgs(invalidId);
    }
  });

  it("always removes old controller authority across fuzzed transfers", async function () {
    const { registry, mintAuthority, holder, controller, newHolder } =
      await loadFixture(deployRegistryFixture);
    const ids = [2n, 17n, 65_535n, 4_294_967_295n, MAX_QYOO_ID - 1n];

    for (const tokenId of ids) {
      await registry.connect(mintAuthority).mint(holder.address, tokenId, `ipfs://before-${tokenId}`);
      await registry.connect(holder).setController(tokenId, controller.address);
      await registry.connect(holder).transferFrom(holder.address, newHolder.address, tokenId);
      expect(await registry.controllerOf(tokenId)).to.equal(ethers.ZeroAddress);
      await expect(registry.connect(controller).setResolver(tokenId, `ipfs://stale-${tokenId}`))
        .to.be.revertedWithCustomError(registry, "NotResolverOperator");
      await registry.connect(newHolder).setResolver(tokenId, `ipfs://after-${tokenId}`);
    }
  });
});
