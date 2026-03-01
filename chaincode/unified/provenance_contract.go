package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// ============================================================================
// PROVENANCE CONTRACT
// ============================================================================

// ProvenanceContract provides functions for tracking AM part lifecycle events.
type ProvenanceContract struct {
	contractapi.Contract
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

// recordEvent persists a ProvenanceEvent to the ledger keyed by its transaction
// ID and returns that transaction ID for linking to the asset's history.
func (pc *ProvenanceContract) recordEvent(
	ctx contractapi.TransactionContextInterface,
	event ProvenanceEvent,
) (string, error) {
	txID := ctx.GetStub().GetTxID()

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return "", fmt.Errorf("failed to get transaction timestamp: %v", err)
	}
	event.Timestamp = txTimestamp.AsTime().UTC().Format(time.RFC3339)

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return "", fmt.Errorf("failed to marshal event: %v", err)
	}

	if err := ctx.GetStub().PutState("EVENT_"+txID, eventJSON); err != nil {
		return "", fmt.Errorf("failed to store event: %v", err)
	}

	return txID, nil
}

// appendAssetHistory appends a new transaction ID to the asset's HistoryTxIDs
// and updates CurrentLifecycleStage.
func (pc *ProvenanceContract) appendAssetHistory(
	ctx contractapi.TransactionContextInterface,
	assetID string,
	txID string,
	newStage string,
) error {
	asset, err := pc.ReadAsset(ctx, assetID)
	if err != nil {
		return err
	}

	asset.CurrentLifecycleStage = newStage
	asset.HistoryTxIDs = append(asset.HistoryTxIDs, txID)

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return fmt.Errorf("failed to marshal asset: %v", err)
	}

	return ctx.GetStub().PutState(assetID, assetJSON)
}

// ============================================================================
// LIFECYCLE FUNCTIONS
// ============================================================================

// CreateMaterialCertification registers a new material batch on the blockchain.
// This is the genesis event for an AM part's provenance chain.
func (pc *ProvenanceContract) CreateMaterialCertification(
	ctx contractapi.TransactionContextInterface,
	assetID string,
	materialType string,
	materialBatchID string,
	supplierID string,
	offChainDataHash string,
) error {
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSPID: %v", err)
	}

	exists, err := pc.AssetExists(ctx, assetID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("asset %s already exists", assetID)
	}

	event := ProvenanceEvent{
		EventType:        "MATERIAL_CERTIFICATION",
		AgentID:          clientMSPID,
		OffChainDataHash: offChainDataHash,
		MaterialType:     materialType,
		MaterialBatchID:  materialBatchID,
		SupplierID:       supplierID,
	}

	txID, err := pc.recordEvent(ctx, event)
	if err != nil {
		return err
	}

	asset := Asset{
		AssetID:               assetID,
		Owner:                 clientMSPID,
		CurrentLifecycleStage: "MATERIAL_CERTIFIED",
		HistoryTxIDs:          []string{txID},
	}

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return fmt.Errorf("failed to marshal asset: %v", err)
	}

	return ctx.GetStub().PutState(assetID, assetJSON)
}

// RecordPrintJob records the additive manufacturing print operation.
func (pc *ProvenanceContract) RecordPrintJob(
	ctx contractapi.TransactionContextInterface,
	assetID string,
	printJobID string,
	machineID string,
	materialUsedID string,
	offChainDataHash string,
) error {
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSPID: %v", err)
	}

	event := ProvenanceEvent{
		EventType:        "PRINT_JOB",
		AgentID:          clientMSPID,
		OffChainDataHash: offChainDataHash,
		PrintJobID:       printJobID,
		MachineID:        machineID,
		MaterialUsedID:   materialUsedID,
	}

	txID, err := pc.recordEvent(ctx, event)
	if err != nil {
		return err
	}

	return pc.appendAssetHistory(ctx, assetID, txID, "PRINT_COMPLETE")
}

// RecordInspection records a quality inspection outcome for a printed part.
func (pc *ProvenanceContract) RecordInspection(
	ctx contractapi.TransactionContextInterface,
	assetID string,
	primaryInspectionResult string,
	testStandardApplied string,
	offChainDataHash string,
) error {
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSPID: %v", err)
	}

	event := ProvenanceEvent{
		EventType:               "INSPECTION",
		AgentID:                 clientMSPID,
		OffChainDataHash:        offChainDataHash,
		PrimaryInspectionResult: primaryInspectionResult,
		TestStandardApplied:     testStandardApplied,
	}

	txID, err := pc.recordEvent(ctx, event)
	if err != nil {
		return err
	}

	stage := "INSPECTION_FAILED"
	if primaryInspectionResult == "PASS" || primaryInspectionResult == "pass" {
		stage = "INSPECTION_PASSED"
	}

	return pc.appendAssetHistory(ctx, assetID, txID, stage)
}

// RecordCertification records the final quality certification of the part.
func (pc *ProvenanceContract) RecordCertification(
	ctx contractapi.TransactionContextInterface,
	assetID string,
	finalTestResult string,
	certificateID string,
	offChainDataHash string,
) error {
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSPID: %v", err)
	}

	event := ProvenanceEvent{
		EventType:        "CERTIFICATION",
		AgentID:          clientMSPID,
		OffChainDataHash: offChainDataHash,
		FinalTestResult:  finalTestResult,
		CertificateID:    certificateID,
	}

	txID, err := pc.recordEvent(ctx, event)
	if err != nil {
		return err
	}

	stage := "CERTIFICATION_FAILED"
	if finalTestResult == "PASS" || finalTestResult == "pass" {
		stage = "CERTIFIED"
	}

	return pc.appendAssetHistory(ctx, assetID, txID, stage)
}

// AddHistoryEvent records a generic lifecycle event not covered by the
// specific functions above.
func (pc *ProvenanceContract) AddHistoryEvent(
	ctx contractapi.TransactionContextInterface,
	assetID string,
	eventType string,
	offChainDataHash string,
) error {
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSPID: %v", err)
	}

	event := ProvenanceEvent{
		EventType:        eventType,
		AgentID:          clientMSPID,
		OffChainDataHash: offChainDataHash,
	}

	txID, err := pc.recordEvent(ctx, event)
	if err != nil {
		return err
	}

	return pc.appendAssetHistory(ctx, assetID, txID, eventType)
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

// ReadAsset returns the current state of an asset from the world state.
func (pc *ProvenanceContract) ReadAsset(
	ctx contractapi.TransactionContextInterface,
	assetID string,
) (*Asset, error) {
	assetJSON, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to read world state: %v", err)
	}
	if assetJSON == nil {
		return nil, fmt.Errorf("asset %s does not exist", assetID)
	}

	var asset Asset
	if err := json.Unmarshal(assetJSON, &asset); err != nil {
		return nil, fmt.Errorf("failed to unmarshal asset: %v", err)
	}

	return &asset, nil
}

// GetAssetHistory returns the full ordered provenance history of an asset.
func (pc *ProvenanceContract) GetAssetHistory(
	ctx contractapi.TransactionContextInterface,
	assetID string,
) (*HistoryResult, error) {
	asset, err := pc.ReadAsset(ctx, assetID)
	if err != nil {
		return nil, err
	}

	var events []ProvenanceEvent
	for _, txID := range asset.HistoryTxIDs {
		eventJSON, err := ctx.GetStub().GetState("EVENT_" + txID)
		if err != nil || eventJSON == nil {
			continue
		}

		var event ProvenanceEvent
		if err := json.Unmarshal(eventJSON, &event); err != nil {
			continue
		}

		events = append(events, event)
	}

	return &HistoryResult{Events: events}, nil
}

// AssetExists returns true when an asset with the given ID exists in world state.
func (pc *ProvenanceContract) AssetExists(
	ctx contractapi.TransactionContextInterface,
	assetID string,
) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return false, fmt.Errorf("failed to read world state: %v", err)
	}
	return assetJSON != nil, nil
}
