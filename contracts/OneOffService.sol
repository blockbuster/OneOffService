// SPDX-License-Identifier: MIT
// Tells the Solidity compiler to compile only from v0.8.13 to v0.9.0
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OneOffService {
    // Service cost is in stable coin like USDT
    IERC20 public coin;

    // Seconds in day
    uint public constant SECONDS_IN_DAY = 86400;

    // Counterparties of the contract
    address public customer;
    address public contractor;
    address public inspector;

    // Full cost of the service
    uint256 public serviceCost;

    // Number of days since the contract start
    uint public deadlineDays;

    // Penalty for each day of delay after the deadline
    uint256 public penaltyFee;

    // Date when customer deposited money
    uint256 public startDate;

    // Date when contractor completed the work
    uint256 public completeDate;

    // Deadline date
    uint256 public deadlineDate;

    // Signing status
    bool public isCustomerSigned = false;
    bool public isContractorSigned = false;

    // Status of the service
    enum Status {Pending, Started, Completed, Approved, Disputed, Rejected}
    Status public status;

    // Constructor
    constructor(
        address _coinContract,
        address _contractor,
        address _inspector,
        uint256 _serviceCost,
        uint _deadlineDays,
        uint256 _penaltyFee
    ) {
        coin = IERC20(_coinContract);
        customer = msg.sender;
        contractor = _contractor;
        inspector = _inspector;
        serviceCost = _serviceCost;
        deadlineDays = _deadlineDays;
        penaltyFee = _penaltyFee;
        status = Status.Pending;
    }

    // Customer and contractor must sign the contract before start
    function sign() external {
        require(msg.sender == customer || msg.sender == contractor, "Only customer or contractor can sign");
        if (msg.sender == customer) {
            isCustomerSigned = true;
        } else {
            isContractorSigned = true;
        }
    }

    // Customer sets the sate to Started and deposits service cost
    function start() external {
        require(msg.sender == customer, "Only customer can start the contract");
        require(isCustomerSigned && isContractorSigned, "Contract is not fully signed");

        require(coin.balanceOf(msg.sender) >= serviceCost, "Insufficient balance");
        bool success = coin.transferFrom(msg.sender, address(this), serviceCost);
        require(success, "Deposit transfer failed");

        startDate = block.timestamp;
        deadlineDate = startDate + deadlineDays * SECONDS_IN_DAY;

        status = Status.Started;
    }

    // Contractor sets the state to Complete
    function completeWork() external {
        require(msg.sender == contractor, "Only contractor can complete the work");
        require(status == Status.Started, "Contract must be in status 'Started'");
        completeDate = block.timestamp;
        status = Status.Completed;
    }

    // Customer approves, money is transferred to Contractor
    function approveWork() external {
        require(msg.sender == customer, "Only customer can approve the work");
        require(status == Status.Completed, "Work is not completed");
        status = Status.Approved;
        payCounterparties(true);
    }

    // Customer declines work, now inspector has to resolve dispute
    function disputeWork() external {
        require(msg.sender == customer, "Only customer can dispute the work");
        require(status == Status.Completed, "Work is not completed");
        status = Status.Disputed;
    }

    // Inspector resolves th dispute in favor of either Customer of Contractor
    function resolveDispute(bool approve) external {
        require(msg.sender == inspector, "Only inspector can resolve dispute");
        require(status == Status.Disputed, "No dispute to resolve");
        if (approve) {
            status = Status.Approved;
            payCounterparties(true);
        } else {
            status = Status.Rejected;
            payCounterparties(false);
        }
    }

    // Customer can request refund if penalty fee is more than service cost already
    function refund() external {
        require(msg.sender == customer, "Only customer can request refund");
        require(
            status == Status.Started || status == Status.Completed || status == Status.Disputed,
            "Status for refund must be Started or Completed or Disputed"
        );
        uint daysMissed = getDeadlineDaysMissed();
        uint256 refundAmount = penaltyFee * daysMissed;

        require(refundAmount > serviceCost, "Too early for full refund");
        bool success = coin.transfer(customer, serviceCost);
        require(success, "Refund transfer to customer failed");
        status = Status.Rejected;
    }

    // Internal function to pay for the work
    function payCounterparties(bool approved) internal {
        if (!approved) {
            bool success = coin.transfer(customer, serviceCost);
            require(success, "Refund transfer customer to failed");
            return;
        }

        // If the Contractor met the deadline then full pay, otherwise refund
        if (completeDate <= deadlineDate) {
            bool success = coin.transfer(contractor, serviceCost);
            require(success, "Transfer to contractor failed");
        } else {
            uint daysMissed = getDeadlineDaysMissed();
            uint256 refundAmount = penaltyFee * daysMissed;

            if (refundAmount < serviceCost) {
                bool success = coin.transfer(contractor, serviceCost - refundAmount);
                require(success, "Transfer to contractor failed");

                success = coin.transfer(customer, refundAmount);
                require(success, "Refund transfer to customer failed");
            } else {
                bool success = coin.transfer(customer, serviceCost);
                require(success, "Refund transfer to customer failed");
            }
        }
    }

    // View: get contract counterparties (customer, contractor, inspector)
    function getCounterparties() public view returns (address, address, address){
        return (customer, contractor, inspector);
    }

    // View: get service cost
    function getServiceCost() public view returns (uint256){
        return serviceCost;
    }

    // View: get deadline days
    function getDeadlineDays() public view returns (uint){
        return deadlineDays;
    }

    function getTime() public view returns (uint256) {
        return block.timestamp;
    }

    // View: get number of days after deadline
    function getDeadlineDaysMissed() public view returns (uint) {

        uint256 date = completeDate == 0 ? block.timestamp : completeDate;
        if (date <= deadlineDate) {
            return 0;
        } else {
            return (date - deadlineDate) / SECONDS_IN_DAY;
        }
    }

    // View: get start date
    function getStartDate() public view returns (uint256){
        return startDate;
    }

    // View: get deadline date (start date + deadline days)
    function getDeadlineDate() public view returns (uint256){
        return deadlineDate;
    }

    // View: get signing status (customer, contractor)
    function getSignStatus() public view returns (bool, bool){
        return (isCustomerSigned, isContractorSigned);
    }

    // View: get signing status (customer, contractor)
    function getWorkStatus() public view returns (Status){
        return status;
    }

    // View: get coin address
    function getCoinAddress() public view returns (address){
        return address(coin);
    }
}
