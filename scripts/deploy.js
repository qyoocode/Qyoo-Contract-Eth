const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Get the contract factory
  const Qyoo = await hre.ethers.getContractFactory("Qyoo");
  console.log("Contract factory obtained.");

  // Deploy the contract
  const qyoo = await Qyoo.deploy();
  console.log("Deployment transaction sent. Waiting for deployment...");

  // Wait for the deployment to be mined
  await qyoo.waitForDeployment();
  console.log("Contract deployed.");

  // Get the contract address
  const address = await qyoo.getAddress();
  console.log("Qyoo deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying contract:", error);
    process.exit(1);
  });

