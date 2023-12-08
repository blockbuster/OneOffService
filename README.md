# One-off Service Smart Contract

An example of a Solidity smart contract designed for real-life service agreements.

## How It Works

The customer and the contractor have agreed upon a price and a deadline for the one-time service.
In the event of a disagreement regarding the quality of work, 
they appoint an Inspector, whom both parties trust, to settle the dispute.

If the contractor fail to meet the deadline,
they will incur a penalty fee for each day of delay. 
If the delay extends significantly, the customer is entitled to a full refund.

The specifics of the actual work can be outlined off-chain, with all parties being fully informed about it.
For enhanced security, documenting and attaching the scope to the contract via a
[proof-of-existense](https://github.com/MaxXor/proof-of-existence) method is advisable.
This approach ensures a reliable and verifiable record of the agreement's details.

<img src=img/contract.png width="400" />


## Contract Actions and States

The contract may exist in six possible states:

**Pending**, **Started**, **Completed**, **Approved**, **Disputed** and **Rejected**.

To initiate the contract, both parties must first sign it.

Once the contract is fully signed, the customer initiates it by calling `start()`.

Subsequently, the service cost is deducted from the customer's wallet and secured within the contract. 

<img src=img/sign.png width="550" />

Once the work is completed, the contractor invokes `completeWork()` and awaits approval.
The status of the contract becomes `Completed`.

<img src=img/complete_work.png width="550" />

Based on the quality of the work, the customer may choose to either approve or dispute it.

In the event of approval, the locked service fee is transferred to the contractor's wallet.

<img src=img/approve_work.png width="550" />

### Dispute Resolving

Following the review, the inspector decides to either approve or reject the work.
If the work is rejected, the fee is returned to the customer.

<img src=img/resolve_dispute.png width="550" />

### Completing After the Deadline

If the work is completed past the deadline, a penalty fee is imposed.
Consequently, even if the work is approved, the contractor receives only a portion of the full payment.


If the delay is excessive, the customer has the option to invoke `refund()` and receive a full reimbursement.

<img src=img/refund.png width="550" />


## Deployment

Install truffle and npm dependencies:
```bash
npm install -g truffle
npm install
```

Build your contract:
```bash
truffle build
```

Configure your contract parameters in [truffle-config.js](truffle-config.js).

Create `.env` file and setup your wallet and Infura project id:

```ini
PRIVATE_KEY="..."
INFURA_PROJECT_ID="..."
```

Now, deploy a contract to a testnet:

```bash
truffle migrate --network goerli
```

### Deployed examples:

FakeUSD Contract:
https://goerli.etherscan.io/address/0x8b990C9F1F073Cd5f53e951F159A8b3d2eDE9AD2

OneOffService Contract:
https://goerli.etherscan.io/address/0x5445433007573CbAbEa8F58Da6b6d62FFef9c16d


## Interaction With the Contract 


This is a standard method for querying Ethereum smart contracts,
which requires a web or mobile application.

See the example code of the client which uses `ethers.js` in
[client/one_off_service_client.js](client/one_off_service_client.js).

## Testing

The contract is covered with the basic tests for all the major use cases.

Pre-confition: run truffle development server for test connections:
```bash
truffle develop
```

```bash
truffle test
Using network 'development'.


Compiling your contracts...
===========================
> Everything is up to date, there is nothing to compile.


  Contract: OneOffService
    ✔ Initial test balances
    ✔ Initial counterparties
    ✔ Initial cost, coin address, deadline, sign status, work status
    ✔ Sign status changes (39ms)
    ✔ Start contract (196ms)
    ✔ Complete work (118ms)
    ✔ Approve work by customer (160ms)
    ✔ Dispute and approve (171ms)
    ✔ Dispute and reject (152ms)
    ✔ Approve after deadline (148ms)
    ✔ Too long after deadline - full refund (129ms)


  11 passing (2s)
```

