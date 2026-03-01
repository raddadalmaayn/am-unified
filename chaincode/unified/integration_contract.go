package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// ============================================================================
// INTEGRATION CONTRACT
// ============================================================================

// IntegrationContract bridges the provenance and reputation subsystems.
// Its key contribution is:
//   1. Reputation-gated lifecycle operations – actors must meet minimum trust
//      thresholds before their events are accepted on-chain.
//   2. Atomic provenance-plus-reputation transactions – a single blockchain
//      transaction records a manufacturing event AND updates the actor's
//      reputation score, guaranteeing consistency.
//   3. Unified trust reports – a single query returns the full provenance
//      history of a part alongside the trust scores of every actor involved.
type IntegrationContract struct {
	contractapi.Contract
}

// ============================================================================
// REPUTATION GATE MANAGEMENT
// ============================================================================

// SetReputationGate defines or updates the minimum reputation threshold that
// an actor must satisfy before a particular provenance event type is accepted.
// Only callable by admins.
//
// Parameters:
//   eventType  – the lifecycle event (e.g. "PRINT_JOB", "INSPECTION")
//   dimension  – the reputation dimension to check (e.g. "quality")
//   minScoreStr – minimum score in [0, 1]
//   minEventsStr – minimum number of ratings required (confidence gate)
//   enforcedStr  – "true" to actively block under-threshold actors
func (ic *IntegrationContract) SetReputationGate(
	ctx contractapi.TransactionContextInterface,
	eventType string,
	dimension string,
	minScoreStr string,
	minEventsStr string,
	enforcedStr string,
) error {
	if !isAdmin(ctx) {
		return fmt.Errorf("unauthorized: admin role required")
	}

	minScore, err := strconv.ParseFloat(minScoreStr, 64)
	if err != nil || minScore < 0 || minScore > 1 {
		return fmt.Errorf("invalid minScore: must be in [0, 1]")
	}

	minEvents, err := strconv.Atoi(minEventsStr)
	if err != nil || minEvents < 0 {
		return fmt.Errorf("invalid minEvents: must be a non-negative integer")
	}

	enforced := enforcedStr == "true"

	// Validate the dimension exists in the system config
	config, err := getConfig(ctx)
	if err != nil {
		return err
	}
	if !config.ValidDimensions[dimension] {
		return fmt.Errorf("unknown dimension: %s", dimension)
	}

	gate := ReputationGate{
		EventType:   eventType,
		Dimension:   dimension,
		MinScore:    minScore,
		MinEvents:   minEvents,
		Enforced:    enforced,
		LastUpdated: time.Now().Unix(),
	}

	gateJSON, err := json.Marshal(gate)
	if err != nil {
		return fmt.Errorf("failed to marshal gate: %v", err)
	}

	gateKey := fmt.Sprintf("REP_GATE:%s", eventType)
	if err := ctx.GetStub().PutState(gateKey, gateJSON); err != nil {
		return fmt.Errorf("failed to store gate: %v", err)
	}

	payload := map[string]interface{}{
		"eventType": eventType, "dimension": dimension,
		"minScore": minScore, "minEvents": minEvents, "enforced": enforced,
	}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("ReputationGateSet", payloadJSON)

	return nil
}

// GetReputationGate retrieves the reputation gate for a given event type.
func (ic *IntegrationContract) GetReputationGate(
	ctx contractapi.TransactionContextInterface,
	eventType string,
) (*ReputationGate, error) {
	gateKey := fmt.Sprintf("REP_GATE:%s", eventType)
	gateJSON, err := ctx.GetStub().GetState(gateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read gate: %v", err)
	}
	if gateJSON == nil {
		return nil, fmt.Errorf("no reputation gate set for event type: %s", eventType)
	}

	var gate ReputationGate
	if err := json.Unmarshal(gateJSON, &gate); err != nil {
		return nil, fmt.Errorf("failed to unmarshal gate: %v", err)
	}

	return &gate, nil
}

// CheckActorEligibility determines whether an actor meets the reputation gate
// requirement for a given event type.
// Returns a JSON map with: eligible (bool), score, required, gate details.
func (ic *IntegrationContract) CheckActorEligibility(
	ctx contractapi.TransactionContextInterface,
	actorID string,
	eventType string,
) (map[string]interface{}, error) {
	normalizedActorID := normalizeIdentity(actorID)

	gateKey := fmt.Sprintf("REP_GATE:%s", eventType)
	gateJSON, err := ctx.GetStub().GetState(gateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read gate: %v", err)
	}

	// If no gate is configured, actor is always eligible
	if gateJSON == nil {
		return map[string]interface{}{
			"eligible":  true,
			"actorId":   normalizedActorID,
			"eventType": eventType,
			"reason":    "no gate configured",
		}, nil
	}

	var gate ReputationGate
	if err := json.Unmarshal(gateJSON, &gate); err != nil {
		return nil, fmt.Errorf("failed to unmarshal gate: %v", err)
	}

	config, err := getConfig(ctx)
	if err != nil {
		return nil, err
	}

	rep, err := getOrInitReputation(ctx, normalizedActorID, gate.Dimension, config)
	if err != nil {
		return nil, err
	}

	effectiveRep := applyDynamicDecay(rep, config)
	score := effectiveRep.Alpha / (effectiveRep.Alpha + effectiveRep.Beta)
	ci := calculateWilsonCI(effectiveRep.Alpha, effectiveRep.Beta, 0.95)

	eligible := score >= gate.MinScore && rep.TotalEvents >= gate.MinEvents

	return map[string]interface{}{
		"eligible":        eligible,
		"actorId":         normalizedActorID,
		"eventType":       eventType,
		"dimension":       gate.Dimension,
		"score":           score,
		"requiredScore":   gate.MinScore,
		"totalEvents":     rep.TotalEvents,
		"requiredEvents":  gate.MinEvents,
		"confidenceLow":   ci[0],
		"confidenceHigh":  ci[1],
		"gateEnforced":    gate.Enforced,
	}, nil
}

// ============================================================================
// ATOMIC PROVENANCE + REPUTATION OPERATION
// ============================================================================

// RecordProvenanceWithReputation is the key integration function.
// In a SINGLE atomic transaction it:
//   1. Optionally checks the reputation gate for the event type.
//   2. Records a provenance event on the AM part's lifecycle chain.
//   3. Submits a peer reputation rating for the actor that performed the work.
//   4. Stores a bidirectional link between the provenance event and the rating.
//
// Parameters:
//   assetID          – the AM part asset ID
//   eventType        – MATERIAL_CERTIFICATION | PRINT_JOB | INSPECTION | CERTIFICATION | custom
//   offChainDataHash – SHA-256 hash of the off-chain evidence document
//   ratedActorID     – the actor whose reputation is being updated (e.g. the supplier or operator)
//   ratingValueStr   – the rating [0.0, 1.0] the caller assigns to ratedActorID
//   dimension        – the reputation dimension (quality, delivery, compliance, warranty)
//   evidenceHash     – hash of supporting evidence for the rating
//
// Returns: ratingID (for audit trail)
func (ic *IntegrationContract) RecordProvenanceWithReputation(
	ctx contractapi.TransactionContextInterface,
	assetID string,
	eventType string,
	offChainDataHash string,
	ratedActorID string,
	ratingValueStr string,
	dimension string,
	evidenceHash string,
) (string, error) {
	ratingValue, err := strconv.ParseFloat(ratingValueStr, 64)
	if err != nil || ratingValue < 0 || ratingValue > 1 {
		return "", fmt.Errorf("invalid ratingValue: must be in [0, 1]")
	}

	callerRawID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get caller ID: %v", err)
	}
	callerID := normalizeIdentity(callerRawID)
	normalizedRatedActorID := normalizeIdentity(ratedActorID)

	// Prevent self-rating through this path as well
	if callerID == normalizedRatedActorID {
		return "", fmt.Errorf("caller cannot rate themselves via integrated recording")
	}

	// ── 1. Gate check ─────────────────────────────────────────────────────────
	gateKey := fmt.Sprintf("REP_GATE:%s", eventType)
	gateJSON, _ := ctx.GetStub().GetState(gateKey)
	if gateJSON != nil {
		var gate ReputationGate
		if err := json.Unmarshal(gateJSON, &gate); err == nil && gate.Enforced {
			config, err := getConfig(ctx)
			if err != nil {
				return "", err
			}
			rep, err := getOrInitReputation(ctx, normalizedRatedActorID, gate.Dimension, config)
			if err != nil {
				return "", err
			}
			effectiveRep := applyDynamicDecay(rep, config)
			score := effectiveRep.Alpha / (effectiveRep.Alpha + effectiveRep.Beta)

			if score < gate.MinScore || rep.TotalEvents < gate.MinEvents {
				return "", fmt.Errorf(
					"actor %s does not meet reputation gate for %s: score=%.3f (required=%.3f), events=%d (required=%d)",
					normalizedRatedActorID, eventType, score, gate.MinScore, rep.TotalEvents, gate.MinEvents,
				)
			}
		}
	}

	// ── 2. Record the provenance event ────────────────────────────────────────
	callerMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("failed to get MSPID: %v", err)
	}

	txID := ctx.GetStub().GetTxID()

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return "", fmt.Errorf("failed to get tx timestamp: %v", err)
	}
	ts := txTimestamp.AsTime().UTC().Format(time.RFC3339)

	event := ProvenanceEvent{
		EventType:        eventType,
		AgentID:          callerMSPID,
		Timestamp:        ts,
		OffChainDataHash: offChainDataHash,
	}

	// Determine lifecycle stage based on event type
	lifecycleStage := eventType
	switch eventType {
	case "MATERIAL_CERTIFICATION":
		event.SupplierID = normalizedRatedActorID
		lifecycleStage = "MATERIAL_CERTIFIED"
	case "PRINT_JOB":
		lifecycleStage = "PRINT_COMPLETE"
	case "INSPECTION":
		if ratingValue >= 0.5 {
			lifecycleStage = "INSPECTION_PASSED"
		} else {
			lifecycleStage = "INSPECTION_FAILED"
		}
	case "CERTIFICATION":
		if ratingValue >= 0.5 {
			lifecycleStage = "CERTIFIED"
		} else {
			lifecycleStage = "CERTIFICATION_FAILED"
		}
	}

	// Store the provenance event
	eventJSON, err := json.Marshal(event)
	if err != nil {
		return "", fmt.Errorf("failed to marshal event: %v", err)
	}
	if err := ctx.GetStub().PutState("EVENT_"+txID, eventJSON); err != nil {
		return "", fmt.Errorf("failed to store provenance event: %v", err)
	}

	// Update or create the asset record
	assetJSON, _ := ctx.GetStub().GetState(assetID)
	var asset Asset
	if assetJSON != nil {
		json.Unmarshal(assetJSON, &asset)
	} else {
		// Genesis event – create the asset
		asset = Asset{
			AssetID:      assetID,
			Owner:        callerMSPID,
			HistoryTxIDs: []string{},
		}
	}
	asset.CurrentLifecycleStage = lifecycleStage
	asset.HistoryTxIDs = append(asset.HistoryTxIDs, txID)

	updatedAssetJSON, err := json.Marshal(asset)
	if err != nil {
		return "", fmt.Errorf("failed to marshal asset: %v", err)
	}
	if err := ctx.GetStub().PutState(assetID, updatedAssetJSON); err != nil {
		return "", fmt.Errorf("failed to update asset: %v", err)
	}

	// ── 3. Submit the reputation rating ───────────────────────────────────────
	config, err := getConfig(ctx)
	if err != nil {
		return "", err
	}
	if !config.ValidDimensions[dimension] {
		return "", fmt.Errorf("invalid dimension: %s", dimension)
	}

	// Verify caller has minimum stake to rate
	callerStake, err := getOrInitStake(ctx, callerID)
	if err != nil {
		return "", fmt.Errorf("failed to get caller stake: %v", err)
	}
	if callerStake.Balance < config.MinStakeRequired {
		return "", fmt.Errorf("caller has insufficient stake to submit ratings: have %.2f, require %.2f",
			callerStake.Balance, config.MinStakeRequired)
	}

	// Calculate rater weight (use ReputationContract's helper indirectly)
	rc := &ReputationContract{}
	weight, err := rc.calculateRaterWeight(ctx, callerID, dimension)
	if err != nil {
		return "", fmt.Errorf("failed to calculate rater weight: %v", err)
	}

	timestamp := txTimestamp.AsTime().Unix()
	ratingID := generateRatingID(callerID, normalizedRatedActorID, dimension, timestamp)

	rating := Rating{
		RatingID:      ratingID,
		RaterID:       callerID,
		ActorID:       normalizedRatedActorID,
		Dimension:     dimension,
		Value:         ratingValue,
		Weight:        weight,
		Evidence:      evidenceHash,
		Timestamp:     timestamp,
		TxID:          txID,
		LinkedAssetID: assetID,
		LinkedEventTx: txID,
	}

	ratingJSON, err := json.Marshal(rating)
	if err != nil {
		return "", fmt.Errorf("failed to marshal rating: %v", err)
	}
	if err := ctx.GetStub().PutState(ratingID, ratingJSON); err != nil {
		return "", fmt.Errorf("failed to store rating: %v", err)
	}

	// Update Beta distribution
	if err := rc.updateReputation(ctx, &rating); err != nil {
		return "", fmt.Errorf("failed to update reputation: %v", err)
	}

	// ── 4. Store bidirectional provenance–reputation link ─────────────────────
	link := ProvenanceRepLink{
		AssetID:    assetID,
		EventTxID:  txID,
		RatingID:   ratingID,
		EventType:  eventType,
		RatedActor: normalizedRatedActorID,
		CreatedAt:  timestamp,
	}
	linkJSON, _ := json.Marshal(link)
	linkKey := fmt.Sprintf("PROV_REP_LINK:%s:%s", assetID, txID)
	ctx.GetStub().PutState(linkKey, linkJSON)

	// Also update the stored provenance event with the rating link
	event.LinkedRatingID = ratingID
	updatedEventJSON, _ := json.Marshal(event)
	ctx.GetStub().PutState("EVENT_"+txID, updatedEventJSON)

	// ── 5. Emit unified event ─────────────────────────────────────────────────
	payload := map[string]interface{}{
		"assetId":        assetID,
		"eventType":      eventType,
		"lifecycleStage": lifecycleStage,
		"ratedActorId":   normalizedRatedActorID,
		"ratingId":       ratingID,
		"ratingValue":    ratingValue,
		"dimension":      dimension,
		"txId":           txID,
	}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("ProvenanceWithReputation", payloadJSON)

	return ratingID, nil
}

// ============================================================================
// UNIFIED QUERY FUNCTIONS
// ============================================================================

// GetPartTrustReport generates a comprehensive trust report for a single AM part.
// It returns:
//   - Full provenance history of the asset
//   - Reputation scores (all dimensions, with decay applied) for every actor
//     that appears in the provenance history
//   - All reputation ratings that are directly linked to provenance events
func (ic *IntegrationContract) GetPartTrustReport(
	ctx contractapi.TransactionContextInterface,
	assetID string,
) (*PartTrustReport, error) {
	// Load asset
	assetJSON, err := ctx.GetStub().GetState(assetID)
	if err != nil || assetJSON == nil {
		return nil, fmt.Errorf("asset not found: %s", assetID)
	}

	var asset Asset
	if err := json.Unmarshal(assetJSON, &asset); err != nil {
		return nil, fmt.Errorf("failed to unmarshal asset: %v", err)
	}

	config, err := getConfig(ctx)
	if err != nil {
		return nil, err
	}

	report := &PartTrustReport{
		AssetID:          assetID,
		CurrentStage:     asset.CurrentLifecycleStage,
		ProvenanceHistory: []ProvenanceEvent{},
		ActorTrustScores: make(map[string]ActorReputationSummary),
		LinkedRatings:    []Rating{},
		GeneratedAt:      time.Now().Unix(),
	}

	seenActors := make(map[string]bool)

	// Walk the provenance history
	for _, txID := range asset.HistoryTxIDs {
		eventJSON, err := ctx.GetStub().GetState("EVENT_" + txID)
		if err != nil || eventJSON == nil {
			continue
		}

		var event ProvenanceEvent
		if err := json.Unmarshal(eventJSON, &event); err != nil {
			continue
		}

		report.ProvenanceHistory = append(report.ProvenanceHistory, event)
		seenActors[event.AgentID] = true

		// Collect any linked rating
		if event.LinkedRatingID != "" {
			ratingJSON, _ := ctx.GetStub().GetState(event.LinkedRatingID)
			if ratingJSON != nil {
				var rating Rating
				if err := json.Unmarshal(ratingJSON, &rating); err == nil {
					report.LinkedRatings = append(report.LinkedRatings, rating)
					seenActors[rating.ActorID] = true
				}
			}
		}
	}

	// Build trust scores for all seen actors
	dimensions := []string{"quality", "delivery", "compliance", "warranty"}
	for actorID := range seenActors {
		if actorID == "" {
			continue
		}
		summary := ActorReputationSummary{
			ActorID:    actorID,
			Dimensions: make(map[string]DimensionScore),
		}
		totalRatings := 0

		for _, dim := range dimensions {
			if !config.ValidDimensions[dim] {
				continue
			}
			rep, err := getOrInitReputation(ctx, actorID, dim, config)
			if err != nil {
				continue
			}
			effectiveRep := applyDynamicDecay(rep, config)
			score := effectiveRep.Alpha / (effectiveRep.Alpha + effectiveRep.Beta)
			ci := calculateWilsonCI(effectiveRep.Alpha, effectiveRep.Beta, 0.95)

			summary.Dimensions[dim] = DimensionScore{
				Score:          score,
				Alpha:          effectiveRep.Alpha,
				Beta:           effectiveRep.Beta,
				TotalEvents:    rep.TotalEvents,
				ConfidenceLow:  ci[0],
				ConfidenceHigh: ci[1],
			}
			totalRatings += rep.TotalEvents
		}

		summary.TotalRatings = totalRatings
		summary.GeneratedAt = time.Now().Unix()
		report.ActorTrustScores[actorID] = summary
	}

	return report, nil
}

// GetActorTrustSummary retrieves an actor's reputation across all valid dimensions.
func (ic *IntegrationContract) GetActorTrustSummary(
	ctx contractapi.TransactionContextInterface,
	actorID string,
) (*ActorReputationSummary, error) {
	normalizedActorID := normalizeIdentity(actorID)

	config, err := getConfig(ctx)
	if err != nil {
		return nil, err
	}

	summary := &ActorReputationSummary{
		ActorID:    normalizedActorID,
		Dimensions: make(map[string]DimensionScore),
		GeneratedAt: time.Now().Unix(),
	}

	totalRatings := 0

	for dim := range config.ValidDimensions {
		rep, err := getOrInitReputation(ctx, normalizedActorID, dim, config)
		if err != nil {
			continue
		}
		effectiveRep := applyDynamicDecay(rep, config)
		score := effectiveRep.Alpha / (effectiveRep.Alpha + effectiveRep.Beta)
		ci := calculateWilsonCI(effectiveRep.Alpha, effectiveRep.Beta, 0.95)

		summary.Dimensions[dim] = DimensionScore{
			Score:          score,
			Alpha:          effectiveRep.Alpha,
			Beta:           effectiveRep.Beta,
			TotalEvents:    rep.TotalEvents,
			ConfidenceLow:  ci[0],
			ConfidenceHigh: ci[1],
		}
		totalRatings += rep.TotalEvents
	}

	summary.TotalRatings = totalRatings

	return summary, nil
}

// GetLinkedRatingsForAsset retrieves all reputation ratings that are directly
// linked to provenance events for a given asset.
func (ic *IntegrationContract) GetLinkedRatingsForAsset(
	ctx contractapi.TransactionContextInterface,
	assetID string,
) ([]Rating, error) {
	assetJSON, err := ctx.GetStub().GetState(assetID)
	if err != nil || assetJSON == nil {
		return nil, fmt.Errorf("asset not found: %s", assetID)
	}

	var asset Asset
	if err := json.Unmarshal(assetJSON, &asset); err != nil {
		return nil, fmt.Errorf("failed to unmarshal asset: %v", err)
	}

	var ratings []Rating
	for _, txID := range asset.HistoryTxIDs {
		linkKey := fmt.Sprintf("PROV_REP_LINK:%s:%s", assetID, txID)
		linkJSON, err := ctx.GetStub().GetState(linkKey)
		if err != nil || linkJSON == nil {
			continue
		}

		var link ProvenanceRepLink
		if err := json.Unmarshal(linkJSON, &link); err != nil {
			continue
		}

		ratingJSON, err := ctx.GetStub().GetState(link.RatingID)
		if err != nil || ratingJSON == nil {
			continue
		}

		var rating Rating
		if err := json.Unmarshal(ratingJSON, &rating); err != nil {
			continue
		}

		ratings = append(ratings, rating)
	}

	return ratings, nil
}

// GetSupplyChainMetrics returns system-wide aggregate statistics.
func (ic *IntegrationContract) GetSupplyChainMetrics(
	ctx contractapi.TransactionContextInterface,
) (*SupplyChainMetrics, error) {
	// Count assets via range query on all asset keys
	// We count records that do NOT start with known prefixes
	metrics := &SupplyChainMetrics{
		GeneratedAt: time.Now().Unix(),
	}

	// Count REPUTATION records to derive active actors
	repIterator, err := ctx.GetStub().GetStateByRange("REPUTATION:", "REPUTATION;")
	if err == nil {
		defer repIterator.Close()
		actorSet := make(map[string]bool)
		totalRatings := 0
		for repIterator.HasNext() {
			result, err := repIterator.Next()
			if err != nil {
				continue
			}
			var rep Reputation
			if err := json.Unmarshal(result.Value, &rep); err != nil {
				continue
			}
			actorSet[rep.ActorID] = true
			totalRatings += rep.TotalEvents
		}
		metrics.ActiveActors = len(actorSet)
		metrics.TotalRatings = totalRatings
	}

	// Count DISPUTE records
	disputeIterator, err := ctx.GetStub().GetStateByRange("DISPUTE:", "DISPUTE;")
	if err == nil {
		defer disputeIterator.Close()
		for disputeIterator.HasNext() {
			if _, err := disputeIterator.Next(); err == nil {
				metrics.TotalDisputes++
			}
		}
	}

	// Count PROV_REP_LINK records (events with reputation links)
	linkIterator, err := ctx.GetStub().GetStateByRange("PROV_REP_LINK:", "PROV_REP_LINK;")
	if err == nil {
		defer linkIterator.Close()
		for linkIterator.HasNext() {
			if _, err := linkIterator.Next(); err == nil {
				metrics.LinkedEvents++
			}
		}
	}

	return metrics, nil
}
