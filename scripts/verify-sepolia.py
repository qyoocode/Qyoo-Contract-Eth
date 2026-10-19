#!/usr/bin/env python3
"""Read-only public Sepolia provenance check. No credentials or transactions."""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = {
    "QyooRegistry": "0x4A63452cEA17d6c955055A36540Cf67f1CdD5919",
    "QyooMinter": "0xAD1836742611DFB4fa5E01a3BC9A974d74d963B4",
}
RPC = "https://ethereum-sepolia-rpc.publicnode.com"


def fetch(request):
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def verify(name, address):
    record = fetch(f"https://sourcify.dev/server/v2/contract/11155111/{address}?fields=all")
    if (record.get("chainId") != "11155111" or
        record.get("address", "").lower() != address.lower() or
        record.get("creationMatch") != "exact_match" or
        record.get("runtimeMatch") != "exact_match"):
        raise RuntimeError(f"{name}: deployment verification is not an exact match")
    sources = record["sources"]
    for path, source in sources.items():
        if not path.startswith("project/contracts/"):
            continue
        local = ROOT / path.removeprefix("project/")
        # Only the fixed expected source names are read from the repository.
        if local.name not in {"QyooRegistry.sol", "QyooMinter.sol"} or local.parent != ROOT / "contracts":
            raise RuntimeError("unexpected contract source path")
        if local.read_bytes() != source["content"].encode():
            raise RuntimeError(f"{name}: source mismatch for {local.name}")
    own_source = f"project/contracts/{name}.sol"
    if own_source not in sources:
        raise RuntimeError(f"{name}: source absent from verification record")
    request = Request(RPC, data=json.dumps({"jsonrpc":"2.0","id":1,
        "method":"eth_getCode","params":[address,"latest"]}).encode(),
        headers={"Content-Type":"application/json", "User-Agent":"Qyoo-public-provenance/1"})
    result = fetch(request)
    code = result.get("result")
    if not code or code == "0x" or code.lower() != record["runtimeBytecode"]["onchainBytecode"].lower():
        raise RuntimeError(f"{name}: runtime bytecode unavailable or changed")
    digest = hashlib.sha256((ROOT / "contracts" / f"{name}.sol").read_bytes()).hexdigest()
    print(f"PASS {name} chain=11155111 address={address} source_sha256={digest}")


if __name__ == "__main__":
    for contract, address in CONTRACTS.items():
        verify(contract, address)
