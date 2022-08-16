// deploy/00_deploy_your_contract.js
const { assert } = require("console");

const { ethers } = require("hardhat");

const localChainId = "31337";

// const sleep = (ms) =>
//   new Promise((r) =>
//     setTimeout(() => {
//       console.log(`waited for ${(ms / 1000).toFixed(3)} seconds`);
//       r();
//     }, ms)
//   );

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const OWNER_ADDRESS = deployer;

  const sbDeploymnet = await deploy("SoulBoundNFT", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    // args: ["Hello"],
    log: true,
  });

  const sbProxyRegistryDeploymnet = await deploy("SoulBoundNFTProxyRegistry", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    // args: ["Hello"],
    log: true,
  });

  const sbProxyRegistry = await ethers.getContractAt(
    "SoulBoundNFTProxyRegistry",
    sbProxyRegistryDeploymnet.address
  );

  const sbFactoryDeployment = await deploy("SoulBoundNFTFactory", {
    from: deployer,
    args: [sbProxyRegistryDeploymnet.address],
    log: true,
  });

  await sbProxyRegistry.setProxyFactory(sbFactoryDeployment.address);

  const sbFactory = await ethers.getContractAt(
    "SoulBoundNFTFactory",
    sbFactoryDeployment.address
  );

  const upgradeableBeaconTx = await sbFactory.newUpgradeableBeacon(
    sbDeploymnet.address
  );

  const tx = await upgradeableBeaconTx.wait();
  const topic = sbFactory.interface.getEventTopic("UpgradeableBeaconCreated");

  await deploy("YourContract", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    // args: [ "Hello", ethers.utils.parseEther("1.5") ],
    log: true,
    waitConfirmations: 5,
  });

  /* eslint-disable */
  const [beaconAddr] = tx.logs
    .filter((log) => log.topics.find((t) => t === topic))
    .map((log) =>
      sbFactory.interface.decodeEventLog("UpgradeableBeaconCreated", log.data)
    )
    .map((d) => {
      console.log("UpgradeableBeaconCreated", d);
      return d;
    })
    .map((event) => event[1]);

  console.log("upgradeableBeacon deployed to", beaconAddr);

  const UpgradeableBeacon = await ethers.getContractFactory(
    "UpgradeableBeacon"
  );
  const upgradeableBeacon = UpgradeableBeacon.attach(beaconAddr);

  assert(
    (await upgradeableBeacon.implementation()) == sbDeploymnet.address,
    "Address of implementation is not correct"
  );

  await sbFactory.transferOwnership(OWNER_ADDRESS);
  await upgradeableBeacon.transferOwnership(OWNER_ADDRESS);
  await sbProxyRegistry.transferOwnership(OWNER_ADDRESS);
};
module.exports.tags = ["SoulBoundNFT", "SoulBoundNFTFactory"];
