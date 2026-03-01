package main

import (
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

func main() {
	// Register all three sub-contracts in the unified chaincode.
	// Fabric clients invoke functions as:
	//   ProvenanceContract:CreateMaterialCertification
	//   ReputationContract:InitConfig
	//   IntegrationContract:RecordProvenanceWithReputation
	chaincode, err := contractapi.NewChaincode(
		new(ProvenanceContract),
		new(ReputationContract),
		new(IntegrationContract),
	)
	if err != nil {
		fmt.Printf("Error creating unified AM chaincode: %v\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting unified AM chaincode: %v\n", err)
	}
}
