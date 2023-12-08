/**
 * Example usage of the One-Off Service smart contract.
 * Reading data from views, signing txs.
 */

const fs = require("fs")
const {ethers} = require("ethers");

require("dotenv").config();

const coinContractAddress = process.env["COIN_CONTRACT_ADDRESS"];
const oneOffServiceContractAddress = process.env["ONE_OFF_SERVICE_CONTRACT_ADDRESS"];
const rpcEndpoint = process.env["RPC_ENDPOINT"];
const privateKey = process.env["WALLET_PRIVATE_KEY"];

const provider = new ethers.getDefaultProvider(rpcEndpoint)

/**
 * Reads ABI JSON file
 */
const getABI = async (path) => {
    const data = await fs.promises.readFile(path);
    return JSON.parse(data);
}

/**
 * Prints general one-off service contract data
 */
const showOneOffServiceSetup = async (contract) => {
    const [customer, contractor, inspector] = await contract.getCounterparties();
    const delimiter = "-".repeat(5);

    console.table({
        "Customer": customer,
        "Contractor": contractor,
        "Inspector": inspector,
        [delimiter]: delimiter,
        "Service cost":  await contract.getServiceCost(),
        "Coin address":  await contract.getCoinAddress(),
        "Deadline":  await contract.getDeadlineDays() + " days",
    })
}

/**
 * Print contract sign status
 */
const showSignStatus = async (contract) => {
    const [customerSigned, contractorSigned] = await contract.getSignStatus();
    console.log("Customer signed: " + customerSigned)
    console.log("Contractor signed: " + contractorSigned)
}

/**
 * Sign contract TX
 */
const signContract = async (contract) => {
    console.log("Signing contract...")

    const transaction = await contract.sign();
    const transactionReceipt = await transaction.wait();

    if (transactionReceipt.status !== 1) {
        console.error("Failed signing contract!")
    } else {
        console.log("Contract has been signed successfully")
    }
}

/**
 * MAIN
 */
const main = async () => {
    const coinContractABI = await getABI("../abi/FakeUSD.json");
    const oneOffServiceContractABI = await getABI("../abi/OneOffService.json");

    // Depending on the signer (customer, contractor, inspector) different functions are accessible
    const signer = new ethers.Wallet(privateKey, provider);

    const coinContract = new ethers.Contract(
        coinContractAddress,
        coinContractABI,
        signer,
    );
    const oneOffServiceContract = new ethers.Contract(
        oneOffServiceContractAddress,
        oneOffServiceContractABI,
        signer,
    );

    // Show contract setup
    await showOneOffServiceSetup(oneOffServiceContract)
    await showSignStatus(oneOffServiceContract)

    // Execute sign TX (from either customer of contractor)
    await signContract(oneOffServiceContract)
    await showSignStatus(oneOffServiceContract)

    /**
     * Now using the same way of sending TXs and checking status write your workflow
     */
}

main()
