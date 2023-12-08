const FakeUSD = artifacts.require("FakeUSD");
const OneOffService = artifacts.require("OneOffService");
const helper = require("../utils/utils.js");

contract("OneOffService", (accounts) => {
  let coin;
  let service;

  const SERVICE_COST = 1000;
  const DEADLINE_DAYS = 14;
  const PENALTY_PER_DAY = 100;
  const CUSTOMER = accounts[0];
  const CONTRACTOR = accounts[1];
  const INSPECTOR = accounts[2];
  const SECONDS_IN_DAY = 86400;

  // Shortcut to verify balances
  const assertBalances = async (
    expectedCustomerBalance,
    expectedContractorBalance,
    expectedServiceBalance,
  ) => {
    const customerBalance = await coin.balanceOf.call(CUSTOMER);
    const contractorBalance = await coin.balanceOf.call(CONTRACTOR);
    const serviceBalance = await coin.balanceOf.call(service.address);

    assert.equal(
      customerBalance.valueOf().toNumber(),
      expectedCustomerBalance,
      "Customer balance does not match",
    );
    assert.equal(
      contractorBalance.valueOf().toNumber(),
      expectedContractorBalance,
      "Contractor balance does not match",
    );
    assert.equal(
      serviceBalance.valueOf().toNumber(),
      expectedServiceBalance,
      "Service contract balance does not match",
    );
  };

  // Shortcut to verify signing status
  const assertSignStatus = async (
    expectedCustomerSigned,
    expectedContractorSigned,
  ) => {
    const signStatus = await service.getSignStatus.call();
    assert.deepEqual(
      signStatus,
      { 0: expectedCustomerSigned, 1: expectedContractorSigned },
      "Sign status is wrong",
    );
  };

  // Shortcut to verify work status
  const assertWorkStatus = async (expectedWorkStatus) => {
    const workStatus = await service.getWorkStatus.call();
    assert.equal(workStatus, expectedWorkStatus, "Work status is wrong");
  };

  // Shortcut to verify expected exceptions
  const assertCallFailure = async (promise, errorMsg) => {
    try {
      await promise;
      assert.fail(errorMsg);
    } catch (err) {
      assert.include(err.message, "revert", errorMsg);
    }
  };

  beforeEach("should setup the contract instance", async () => {
    coin = await FakeUSD.new(SERVICE_COST);
    service = await OneOffService.new(
      coin.address,
      CONTRACTOR,
      INSPECTOR,
      SERVICE_COST,
      DEADLINE_DAYS,
      PENALTY_PER_DAY,
    );
  });

  it("Initial test balances", async () => {
    await assertBalances(SERVICE_COST, 0, 0);
  });

  it("Initial counterparties", async () => {
    const counterparties = await service.getCounterparties.call();
    assert.deepEqual(
      counterparties,
      { 0: CUSTOMER, 1: CONTRACTOR, 2: INSPECTOR },
      "Wrong counterparties of the contract",
    );
  });

  it("Initial cost, coin address, deadline, sign status, work status", async () => {
    const cost = await service.getServiceCost.call();
    const deadlineDays = await service.getDeadlineDays.call();
    const deadline = await service.getDeadlineDate.call();
    const coinAddress = await service.getCoinAddress.call();
    assert.equal(cost, SERVICE_COST, "Invalid service cost");
    assert.equal(coinAddress, coin.address, "Wrong coin address");
    assert.equal(deadlineDays, DEADLINE_DAYS, "Invalid dealine");
    assert.equal(deadline, 0, "Initial deadline is not  0");
    await assertSignStatus(false, false);
    await assertWorkStatus(OneOffService.Status.Pending);
  });

  it("Sign status changes", async () => {
    await service.sign({ from: CUSTOMER });
    await assertSignStatus(true, false);
    await service.sign({ from: CONTRACTOR });
    await assertSignStatus(true, true);
  });

  it("Start contract", async () => {
    await assertCallFailure(
      service.start({ from: CONTRACTOR }),
      "Only customer can start the contract",
    );
    await assertCallFailure(
      service.start({ from: CUSTOMER }),
      "Contract is not fully signed",
    );
    await service.sign({ from: CUSTOMER });
    await service.sign({ from: CONTRACTOR });
    await coin.approve(service.address, SERVICE_COST, { from: CUSTOMER });
    await service.start({ from: CUSTOMER });
    await assertWorkStatus(OneOffService.Status.Started);
    let startBlock = await web3.eth.getBlock("latest");
    let startDate = await service.getStartDate.call();
    assert.equal(
      startBlock.timestamp,
      startDate.toNumber(),
      "Start date must be current block timestamp",
    );
    const deadlineDate = await service.getDeadlineDate.call();
    const expectedDeadline =
      startDate.toNumber() + DEADLINE_DAYS * SECONDS_IN_DAY;
    assert.equal(
      deadlineDate.toNumber(),
      expectedDeadline,
      "Deadline calculated improperly",
    );
    // service cost is locked on contract
    await assertBalances(0, 0, SERVICE_COST);
  });

  it("Complete work", async () => {
    await service.sign({ from: CUSTOMER });
    await service.sign({ from: CONTRACTOR });
    await assertCallFailure(
      service.completeWork({ from: CONTRACTOR }),
      "Contract must be in status 'Started'",
    );
    await coin.approve(service.address, SERVICE_COST, { from: CUSTOMER });
    await service.start({ from: CUSTOMER });
    await assertCallFailure(
      service.completeWork({ from: CUSTOMER }),
      "Only contractor can complete the work",
    );
    await service.completeWork({ from: CONTRACTOR });
    await assertWorkStatus(OneOffService.Status.Completed);
    // money stay in a contract
    await assertBalances(0, 0, SERVICE_COST);
  });

  it("Approve work by customer", async () => {
    await service.sign({ from: CUSTOMER });
    await service.sign({ from: CONTRACTOR });
    await coin.approve(service.address, SERVICE_COST, { from: CUSTOMER });
    await service.start({ from: CUSTOMER });
    await assertCallFailure(
      service.approveWork({ from: CUSTOMER }),
      "Work is not completed",
    );
    await service.completeWork({ from: CONTRACTOR });
    await assertCallFailure(
      service.approveWork({ from: CONTRACTOR }),
      "Only customer can approve the work",
    );
    await service.approveWork({ from: CUSTOMER });
    await assertWorkStatus(OneOffService.Status.Approved);
    // money go to contractor
    await assertBalances(0, SERVICE_COST, 0);
  });

  it("Dispute and approve", async () => {
    await service.sign({ from: CUSTOMER });
    await service.sign({ from: CONTRACTOR });
    await coin.approve(service.address, SERVICE_COST, { from: CUSTOMER });
    await service.start({ from: CUSTOMER });
    await assertCallFailure(
      service.disputeWork({ from: CUSTOMER }),
      "Work is not completed",
    );
    await service.completeWork({ from: CONTRACTOR });
    await assertCallFailure(
      service.approveWork({ from: CONTRACTOR }),
      "Only customer can dispute the work",
    );
    await service.disputeWork({ from: CUSTOMER });
    await assertWorkStatus(OneOffService.Status.Disputed);
    await assertCallFailure(
      service.resolveDispute(true, { from: CONTRACTOR }),
      "Only inspector can resolve dispute",
    );
    await service.resolveDispute(true, { from: INSPECTOR });
    await assertWorkStatus(OneOffService.Status.Approved);
    // money go to contractor
    await assertBalances(0, SERVICE_COST, 0);
  });

  it("Dispute and reject", async () => {
    await service.sign({ from: CUSTOMER });
    await service.sign({ from: CONTRACTOR });
    await coin.approve(service.address, SERVICE_COST, { from: CUSTOMER });
    await service.start({ from: CUSTOMER });
    await service.completeWork({ from: CONTRACTOR });
    await service.disputeWork({ from: CUSTOMER });
    await service.resolveDispute(false, { from: INSPECTOR });
    await assertWorkStatus(OneOffService.Status.Rejected);
    // money returned to customer
    await assertBalances(SERVICE_COST, 0, 0);
  });

  it("Approve after deadline", async () => {
    await service.sign({ from: CUSTOMER });
    await service.sign({ from: CONTRACTOR });
    await coin.approve(service.address, SERVICE_COST, { from: CUSTOMER });
    await service.start({ from: CUSTOMER });

    // Delay for 2 days
    await helper.advanceTime((DEADLINE_DAYS + 2) * SECONDS_IN_DAY);
    await service.completeWork({ from: CONTRACTOR });
    const daysMissed = await service.getDeadlineDaysMissed();
    assert.equal(daysMissed, 2, "Wrong days after deadline calculated");
    await service.approveWork({ from: CUSTOMER });
    await assertWorkStatus(OneOffService.Status.Approved);
    const refund = PENALTY_PER_DAY * 2;
    await assertBalances(refund, SERVICE_COST - refund, 0);
  });

  it("Too long after deadline - full refund", async () => {
    await service.sign({ from: CUSTOMER });
    await service.sign({ from: CONTRACTOR });
    await coin.approve(service.address, SERVICE_COST, { from: CUSTOMER });
    await service.start({ from: CUSTOMER });

    // Go to 2 days before the deadline
    await helper.advanceTime((DEADLINE_DAYS + 2) * SECONDS_IN_DAY);
    await helper.advanceBlock();
    await assertCallFailure(
      service.refund({ from: CUSTOMER }),
      "Too early for full refund",
    );

    // Delay for 12 days after deadline
    await helper.advanceTime(10 * SECONDS_IN_DAY);
    await helper.advanceBlock();
    daysMissed = await service.getDeadlineDaysMissed();
    assert.equal(daysMissed, 12, "Wrong days after deadline calculated");

    await service.refund({ from: CUSTOMER });
    await assertBalances(SERVICE_COST, 0, 0);
  });
});
