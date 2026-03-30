package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// ============================================================================
// REPUTATION CONTRACT
// ============================================================================

// ReputationContract provides functions for managing actor reputations using
// a Bayesian Beta distribution model with stake-backed ratings and dispute resolution.
type ReputationContract struct {
	contractapi.Contract
}

// ============================================================================
// GOVERNANCE FUNCTIONS
// ============================================================================

// InitConfig initialises the reputation system with default parameters.
// Must be called once before any other reputation functions.
func (rc *ReputationContract) InitConfig(ctx contractapi.TransactionContextInterface) error {
	existing, err := ctx.GetStub().GetState("SYSTEM_CONFIG")
	if err != nil {
		return fmt.Errorf("failed to read config: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("system config already initialized")
	}

	config := SystemConfig{
		MinStakeRequired: 10000.0,
		DisputeCost:      100.0,
		SlashPercentage:  0.1,

		DecayRate:      0.98,
		DecayPeriod:    86400.0, // seconds in one day
		InitialAlpha:   2.0,
		InitialBeta:    2.0,
		MinRaterWeight: 0.1,
		MaxRaterWeight: 5.0,

		ValidDimensions: map[string]bool{
			"quality":    true,
			"delivery":   true,
			"compliance": true,
			"warranty":   true,
		},
		MetaDimensions: map[string]string{
			"quality":    "rating_quality",
			"delivery":   "rating_delivery",
			"compliance": "rating_compliance",
			"warranty":   "rating_warranty",
		},

		Version:     1,
		LastUpdated: time.Now().Unix(),
	}

	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	if err := ctx.GetStub().PutState("SYSTEM_CONFIG", configJSON); err != nil {
		return fmt.Errorf("failed to store config: %v", err)
	}

	ctx.GetStub().SetEvent("ConfigInitialized", configJSON)

	// Seed the ADMIN_LIST with the caller so the bootstrap bypass in isAdmin() closes.
	callerID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get caller ID: %v", err)
	}
	admins := map[string]bool{normalizeIdentity(callerID): true}
	adminsJSON, err := json.Marshal(admins)
	if err != nil {
		return fmt.Errorf("failed to marshal admin list: %v", err)
	}
	if err := ctx.GetStub().PutState("ADMIN_LIST", adminsJSON); err != nil {
		return fmt.Errorf("failed to store admin list: %v", err)
	}

	return nil
}

// UpdateConfig replaces the system configuration (admin only).
func (rc *ReputationContract) UpdateConfig(
	ctx contractapi.TransactionContextInterface,
	configJSON string,
) error {
	if !isAdmin(ctx) {
		return fmt.Errorf("unauthorized: admin role required")
	}

	var newConfig SystemConfig
	if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
		return fmt.Errorf("invalid config JSON: %v", err)
	}

	if err := validateConfig(&newConfig); err != nil {
		return fmt.Errorf("invalid configuration: %v", err)
	}

	newConfig.Version++
	newConfig.LastUpdated = time.Now().Unix()

	updatedJSON, err := json.Marshal(newConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	if err := ctx.GetStub().PutState("SYSTEM_CONFIG", updatedJSON); err != nil {
		return fmt.Errorf("failed to update config: %v", err)
	}

	ctx.GetStub().SetEvent("ConfigUpdated", updatedJSON)
	return nil
}

// UpdateDecayRate updates only the reputation decay rate (admin only).
func (rc *ReputationContract) UpdateDecayRate(
	ctx contractapi.TransactionContextInterface,
	newRateStr string,
) error {
	if !isAdmin(ctx) {
		return fmt.Errorf("unauthorized: admin role required")
	}

	newRate, err := strconv.ParseFloat(newRateStr, 64)
	if err != nil || newRate <= 0 || newRate > 1 {
		return fmt.Errorf("invalid decay rate: must be in (0, 1]")
	}

	config, err := getConfig(ctx)
	if err != nil {
		return err
	}

	config.DecayRate = newRate
	config.Version++
	config.LastUpdated = time.Now().Unix()

	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	if err := ctx.GetStub().PutState("SYSTEM_CONFIG", configJSON); err != nil {
		return fmt.Errorf("failed to update config: %v", err)
	}

	payload := map[string]interface{}{"decayRate": newRate, "version": config.Version}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("DecayRateUpdated", payloadJSON)

	return nil
}

// GetConfig retrieves the current system configuration.
func (rc *ReputationContract) GetConfig(ctx contractapi.TransactionContextInterface) (*SystemConfig, error) {
	return getConfig(ctx)
}

// AddDimension registers a new reputation dimension (admin only).
func (rc *ReputationContract) AddDimension(
	ctx contractapi.TransactionContextInterface,
	baseDimension string,
	metaDimension string,
) error {
	if !isAdmin(ctx) {
		return fmt.Errorf("unauthorized: admin role required")
	}

	config, err := getConfig(ctx)
	if err != nil {
		return err
	}

	config.ValidDimensions[baseDimension] = true
	config.MetaDimensions[baseDimension] = metaDimension
	config.Version++
	config.LastUpdated = time.Now().Unix()

	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	if err := ctx.GetStub().PutState("SYSTEM_CONFIG", configJSON); err != nil {
		return fmt.Errorf("failed to store config: %v", err)
	}

	payload := map[string]interface{}{"baseDimension": baseDimension, "metaDimension": metaDimension}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("DimensionAdded", payloadJSON)

	return nil
}

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

// AddAdmin grants admin privileges to an actor (existing admin only).
func (rc *ReputationContract) AddAdmin(
	ctx contractapi.TransactionContextInterface,
	adminID string,
) error {
	if !isAdmin(ctx) {
		return fmt.Errorf("unauthorized: admin role required")
	}

	normalizedAdminID := normalizeIdentity(adminID)

	adminListJSON, _ := ctx.GetStub().GetState("ADMIN_LIST")
	var admins map[string]bool
	if adminListJSON != nil {
		json.Unmarshal(adminListJSON, &admins)
	} else {
		admins = make(map[string]bool)
	}

	admins[normalizedAdminID] = true

	updatedJSON, _ := json.Marshal(admins)
	if err := ctx.GetStub().PutState("ADMIN_LIST", updatedJSON); err != nil {
		return fmt.Errorf("failed to update admin list: %v", err)
	}

	callerID, _ := ctx.GetClientIdentity().GetID()
	auditRecord := map[string]interface{}{
		"action":    "ADD_ADMIN",
		"targetId":  normalizedAdminID,
		"callerId":  normalizeIdentity(callerID),
		"timestamp": time.Now().Unix(),
		"txId":      ctx.GetStub().GetTxID(),
	}
	auditJSON, _ := json.Marshal(auditRecord)
	auditKey := fmt.Sprintf("ADMIN_AUDIT:%s", ctx.GetStub().GetTxID())
	ctx.GetStub().PutState(auditKey, auditJSON)

	payload := map[string]interface{}{"adminId": normalizedAdminID, "action": "added"}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("AdminUpdated", payloadJSON)

	return nil
}

// RemoveAdmin revokes admin privileges (admin only).
func (rc *ReputationContract) RemoveAdmin(
	ctx contractapi.TransactionContextInterface,
	adminID string,
) error {
	if !isAdmin(ctx) {
		return fmt.Errorf("unauthorized: admin role required")
	}

	normalizedAdminID := normalizeIdentity(adminID)

	adminListJSON, err := ctx.GetStub().GetState("ADMIN_LIST")
	if err != nil || adminListJSON == nil {
		return fmt.Errorf("admin list not found")
	}

	var admins map[string]bool
	json.Unmarshal(adminListJSON, &admins)
	delete(admins, normalizedAdminID)

	updatedJSON, _ := json.Marshal(admins)
	if err := ctx.GetStub().PutState("ADMIN_LIST", updatedJSON); err != nil {
		return fmt.Errorf("failed to update admin list: %v", err)
	}

	callerID, _ := ctx.GetClientIdentity().GetID()
	auditRecord := map[string]interface{}{
		"action":    "REMOVE_ADMIN",
		"targetId":  normalizedAdminID,
		"callerId":  normalizeIdentity(callerID),
		"timestamp": time.Now().Unix(),
		"txId":      ctx.GetStub().GetTxID(),
	}
	auditJSON, _ := json.Marshal(auditRecord)
	auditKey := fmt.Sprintf("ADMIN_AUDIT:%s", ctx.GetStub().GetTxID())
	ctx.GetStub().PutState(auditKey, auditJSON)

	payload := map[string]interface{}{"adminId": normalizedAdminID, "action": "removed"}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("AdminUpdated", payloadJSON)

	return nil
}

// AddArbitrator grants arbitrator privileges (admin only).
func (rc *ReputationContract) AddArbitrator(
	ctx contractapi.TransactionContextInterface,
	arbitratorID string,
) error {
	if !isAdmin(ctx) {
		return fmt.Errorf("unauthorized: only admin can add arbitrators")
	}

	normalizedArbitratorID := normalizeIdentity(arbitratorID)

	arbitratorListJSON, _ := ctx.GetStub().GetState("ARBITRATOR_LIST")
	var arbitrators map[string]bool
	if arbitratorListJSON != nil {
		json.Unmarshal(arbitratorListJSON, &arbitrators)
	} else {
		arbitrators = make(map[string]bool)
	}

	arbitrators[normalizedArbitratorID] = true

	updatedJSON, _ := json.Marshal(arbitrators)
	if err := ctx.GetStub().PutState("ARBITRATOR_LIST", updatedJSON); err != nil {
		return fmt.Errorf("failed to update arbitrator list: %v", err)
	}

	callerID, _ := ctx.GetClientIdentity().GetID()
	auditRecord := map[string]interface{}{
		"action":    "ADD_ARBITRATOR",
		"targetId":  normalizedArbitratorID,
		"callerId":  normalizeIdentity(callerID),
		"timestamp": time.Now().Unix(),
		"txId":      ctx.GetStub().GetTxID(),
	}
	auditJSON, _ := json.Marshal(auditRecord)
	auditKey := fmt.Sprintf("ADMIN_AUDIT:%s", ctx.GetStub().GetTxID())
	ctx.GetStub().PutState(auditKey, auditJSON)

	payload := map[string]interface{}{"arbitratorId": normalizedArbitratorID, "action": "added"}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("ArbitratorUpdated", payloadJSON)

	return nil
}

// RemoveArbitrator revokes arbitrator privileges (admin only).
func (rc *ReputationContract) RemoveArbitrator(
	ctx contractapi.TransactionContextInterface,
	arbitratorID string,
) error {
	if !isAdmin(ctx) {
		return fmt.Errorf("unauthorized: only admin can remove arbitrators")
	}

	normalizedArbitratorID := normalizeIdentity(arbitratorID)

	arbitratorListJSON, err := ctx.GetStub().GetState("ARBITRATOR_LIST")
	if err != nil || arbitratorListJSON == nil {
		return fmt.Errorf("arbitrator list not found")
	}

	var arbitrators map[string]bool
	json.Unmarshal(arbitratorListJSON, &arbitrators)
	delete(arbitrators, normalizedArbitratorID)

	updatedJSON, _ := json.Marshal(arbitrators)
	if err := ctx.GetStub().PutState("ARBITRATOR_LIST", updatedJSON); err != nil {
		return fmt.Errorf("failed to update arbitrator list: %v", err)
	}

	callerID, _ := ctx.GetClientIdentity().GetID()
	auditRecord := map[string]interface{}{
		"action":    "REMOVE_ARBITRATOR",
		"targetId":  normalizedArbitratorID,
		"callerId":  normalizeIdentity(callerID),
		"timestamp": time.Now().Unix(),
		"txId":      ctx.GetStub().GetTxID(),
	}
	auditJSON, _ := json.Marshal(auditRecord)
	auditKey := fmt.Sprintf("ADMIN_AUDIT:%s", ctx.GetStub().GetTxID())
	ctx.GetStub().PutState(auditKey, auditJSON)

	payload := map[string]interface{}{"arbitratorId": normalizedArbitratorID, "action": "removed"}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("ArbitratorUpdated", payloadJSON)

	return nil
}

// ============================================================================
// STAKE MANAGEMENT
// ============================================================================

// AddStake deposits financial stake for the invoking actor.
func (rc *ReputationContract) AddStake(
	ctx contractapi.TransactionContextInterface,
	amountStr string,
) error {
	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil || amount <= 0 {
		return fmt.Errorf("invalid amount: must be a positive number")
	}

	actorID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to get actor ID: %v", err)
	}
	normalizedID := normalizeIdentity(actorID)

	stake, err := getOrInitStake(ctx, normalizedID)
	if err != nil {
		return err
	}

	stake.Balance += amount
	stake.UpdatedAt = time.Now().Unix()

	stakeJSON, err := json.Marshal(stake)
	if err != nil {
		return fmt.Errorf("failed to marshal stake: %v", err)
	}

	stakeKey := fmt.Sprintf("STAKE:%s", normalizedID)
	if err := ctx.GetStub().PutState(stakeKey, stakeJSON); err != nil {
		return fmt.Errorf("failed to store stake: %v", err)
	}

	payload := map[string]interface{}{"actorId": normalizedID, "amount": amount, "balance": stake.Balance}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("StakeAdded", payloadJSON)

	return nil
}

// GetStake retrieves an actor's stake record.
func (rc *ReputationContract) GetStake(
	ctx contractapi.TransactionContextInterface,
	actorID string,
) (*Stake, error) {
	normalizedID := normalizeIdentity(actorID)
	return getOrInitStake(ctx, normalizedID)
}

// ResetStake zeroes an actor's stake — for testing only.
func (rc *ReputationContract) ResetStake(
	ctx contractapi.TransactionContextInterface,
	actorID string,
) error {
	normalizedID := normalizeIdentity(actorID)

	stake := &Stake{
		ActorID:   normalizedID,
		Balance:   0,
		Locked:    0,
		UpdatedAt: time.Now().Unix(),
	}

	stakeKey := fmt.Sprintf("STAKE:%s", normalizedID)
	stakeJSON, err := json.Marshal(stake)
	if err != nil {
		return fmt.Errorf("failed to marshal stake: %v", err)
	}

	return ctx.GetStub().PutState(stakeKey, stakeJSON)
}

// ============================================================================
// RATING SUBMISSION
// ============================================================================

// SubmitRating allows a staked actor to submit a peer rating for another actor.
// Returns the generated ratingID.
func (rc *ReputationContract) SubmitRating(
	ctx contractapi.TransactionContextInterface,
	actorID string,
	dimension string,
	valueStr string,
	evidence string,
	timestampStr string,
) (string, error) {
	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil || value < 0 || value > 1 {
		return "", fmt.Errorf("invalid value: must be between 0 and 1")
	}

	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return "", fmt.Errorf("invalid timestamp: %v", err)
	}

	raterID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get rater ID: %v", err)
	}

	normalizedRaterID := normalizeIdentity(raterID)
	normalizedActorID := normalizeIdentity(actorID)

	// Prevent self-rating
	if normalizedRaterID == normalizedActorID {
		return "", fmt.Errorf("self-rating is not allowed")
	}

	// Validate dimension
	config, err := getConfig(ctx)
	if err != nil {
		return "", err
	}
	if !config.ValidDimensions[dimension] {
		return "", fmt.Errorf("invalid dimension: %s", dimension)
	}

	// Verify rater has minimum stake
	raterStake, err := getOrInitStake(ctx, normalizedRaterID)
	if err != nil {
		return "", fmt.Errorf("failed to get rater stake: %v", err)
	}
	if raterStake.Balance < config.MinStakeRequired {
		return "", fmt.Errorf("insufficient stake: have %.2f, require %.2f", raterStake.Balance, config.MinStakeRequired)
	}

	// Calculate rater weight from meta-reputation
	weight, err := rc.calculateRaterWeight(ctx, normalizedRaterID, dimension)
	if err != nil {
		return "", fmt.Errorf("failed to calculate rater weight: %v", err)
	}

	txID := ctx.GetStub().GetTxID()
	ratingID := generateRatingID(normalizedRaterID, normalizedActorID, dimension, timestamp)

	rating := Rating{
		RatingID:  ratingID,
		RaterID:   normalizedRaterID,
		ActorID:   normalizedActorID,
		Dimension: dimension,
		Value:     value,
		Weight:    weight,
		Evidence:  evidence,
		Timestamp: timestamp,
		TxID:      txID,
	}

	ratingJSON, err := json.Marshal(rating)
	if err != nil {
		return "", fmt.Errorf("failed to marshal rating: %v", err)
	}

	if err := ctx.GetStub().PutState(ratingID, ratingJSON); err != nil {
		return "", fmt.Errorf("failed to store rating: %v", err)
	}

	// Index: rater→actor mapping for query
	raterActorKey := fmt.Sprintf("RATER_ACTOR:%s:%s:%s", normalizedRaterID, normalizedActorID, dimension)
	raterActorRecord := map[string]interface{}{
		"raterId":   normalizedRaterID,
		"actorId":   normalizedActorID,
		"dimension": dimension,
		"ratingId":  ratingID,
		"timestamp": timestamp,
	}
	raterActorJSON, _ := json.Marshal(raterActorRecord)
	ctx.GetStub().PutState(raterActorKey, raterActorJSON)

	// Update the rated actor's Beta distribution
	if err := rc.updateReputation(ctx, &rating); err != nil {
		return "", fmt.Errorf("failed to update reputation: %v", err)
	}

	payload := map[string]interface{}{
		"ratingId": ratingID, "raterId": normalizedRaterID,
		"actorId": normalizedActorID, "dimension": dimension,
		"value": value, "weight": weight, "timestamp": timestamp,
	}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("RatingSubmitted", payloadJSON)

	return ratingID, nil
}

// ============================================================================
// DISPUTE RESOLUTION
// ============================================================================

// InitiateDispute allows a rated actor to formally challenge a rating.
// Returns the generated disputeID.
func (rc *ReputationContract) InitiateDispute(
	ctx contractapi.TransactionContextInterface,
	ratingID string,
	reason string,
) (string, error) {
	initiatorID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get initiator ID: %v", err)
	}
	normalizedInitiatorID := normalizeIdentity(initiatorID)

	ratingJSON, err := ctx.GetStub().GetState(ratingID)
	if err != nil || ratingJSON == nil {
		return "", fmt.Errorf("rating not found: %s", ratingID)
	}

	var rating Rating
	if err := json.Unmarshal(ratingJSON, &rating); err != nil {
		return "", fmt.Errorf("failed to unmarshal rating: %v", err)
	}

	if normalizedInitiatorID != rating.ActorID {
		return "", fmt.Errorf("only the rated actor can dispute a rating")
	}

	config, err := getConfig(ctx)
	if err != nil {
		return "", err
	}

	stake, err := getOrInitStake(ctx, normalizedInitiatorID)
	if err != nil {
		return "", err
	}
	if stake.Balance < config.DisputeCost {
		return "", fmt.Errorf("insufficient stake for dispute: %.2f required", config.DisputeCost)
	}

	// Lock the dispute cost
	stake.Balance -= config.DisputeCost
	stake.Locked += config.DisputeCost
	stake.UpdatedAt = time.Now().Unix()

	stakeKey := fmt.Sprintf("STAKE:%s", normalizedInitiatorID)
	stakeJSON, _ := json.Marshal(stake)
	ctx.GetStub().PutState(stakeKey, stakeJSON)

	now := time.Now().Unix()
	disputeID := generateDisputeID(ratingID, normalizedInitiatorID, now)

	dispute := Dispute{
		DisputeID:   disputeID,
		RatingID:    ratingID,
		InitiatorID: normalizedInitiatorID,
		RaterID:     rating.RaterID,
		ActorID:     rating.ActorID,
		Dimension:   rating.Dimension,
		Reason:      reason,
		Status:      "pending",
		CreatedAt:   now,
	}

	disputeJSON, err := json.Marshal(dispute)
	if err != nil {
		return "", fmt.Errorf("failed to marshal dispute: %v", err)
	}
	if err := ctx.GetStub().PutState(disputeID, disputeJSON); err != nil {
		return "", fmt.Errorf("failed to store dispute: %v", err)
	}

	payload := map[string]interface{}{
		"disputeId": disputeID, "ratingId": ratingID,
		"initiatorId": normalizedInitiatorID, "reason": reason,
	}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("DisputeInitiated", payloadJSON)

	return disputeID, nil
}

// ResolveDispute settles an open dispute (arbitrator only).
// verdict must be "upheld" (rating stands) or "overturned" (rating reversed, stake slashed).
func (rc *ReputationContract) ResolveDispute(
	ctx contractapi.TransactionContextInterface,
	disputeID string,
	verdict string,
	arbitratorNotes string,
) error {
	if verdict != "upheld" && verdict != "overturned" {
		return fmt.Errorf("verdict must be 'upheld' or 'overturned'")
	}
	if !isArbitrator(ctx) {
		return fmt.Errorf("unauthorized: arbitrator role required")
	}

	disputeJSON, err := ctx.GetStub().GetState(disputeID)
	if err != nil || disputeJSON == nil {
		return fmt.Errorf("dispute not found: %s", disputeID)
	}

	var dispute Dispute
	if err := json.Unmarshal(disputeJSON, &dispute); err != nil {
		return fmt.Errorf("failed to unmarshal dispute: %v", err)
	}
	if dispute.Status != "pending" {
		return fmt.Errorf("dispute already resolved")
	}

	arbitratorID, _ := ctx.GetClientIdentity().GetID()
	normalizedArbitratorID := normalizeIdentity(arbitratorID)

	dispute.Status = verdict
	dispute.ArbitratorID = normalizedArbitratorID
	dispute.ArbitratorNotes = arbitratorNotes
	dispute.ResolvedAt = time.Now().Unix()

	raterWasCorrect := verdict == "upheld"

	// Update rater's meta-reputation
	if err := rc.updateMetaReputation(ctx, dispute.RaterID, dispute.Dimension, raterWasCorrect); err != nil {
		return fmt.Errorf("failed to update metareputation: %v", err)
	}

	// If overturned, undo the rating and penalise the rater
	if verdict == "overturned" {
		if err := rc.reverseRating(ctx, dispute.RatingID); err != nil {
			return fmt.Errorf("failed to reverse rating: %v", err)
		}
		if err := rc.slashStake(ctx, dispute.RaterID); err != nil {
			return fmt.Errorf("failed to slash stake: %v", err)
		}
	}

	// Return the dispute cost to the initiator
	config, _ := getConfig(ctx)
	initiatorStake, _ := getOrInitStake(ctx, dispute.InitiatorID)
	initiatorStake.Locked -= config.DisputeCost
	initiatorStake.Balance += config.DisputeCost
	initiatorStake.UpdatedAt = time.Now().Unix()

	stakeKey := fmt.Sprintf("STAKE:%s", dispute.InitiatorID)
	stakeJSON, _ := json.Marshal(initiatorStake)
	ctx.GetStub().PutState(stakeKey, stakeJSON)

	// Persist updated dispute
	updatedDisputeJSON, _ := json.Marshal(dispute)
	ctx.GetStub().PutState(disputeID, updatedDisputeJSON)

	payload := map[string]interface{}{
		"disputeId": disputeID, "verdict": verdict,
		"raterWasCorrect": raterWasCorrect, "dimension": dispute.Dimension,
	}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("DisputeResolved", payloadJSON)

	return nil
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

// GetReputation retrieves an actor's current reputation with time-decay applied.
func (rc *ReputationContract) GetReputation(
	ctx contractapi.TransactionContextInterface,
	actorID string,
	dimension string,
) (map[string]interface{}, error) {
	config, err := getConfig(ctx)
	if err != nil {
		return nil, err
	}
	if !config.ValidDimensions[dimension] {
		return nil, fmt.Errorf("invalid dimension: %s", dimension)
	}

	normalizedActorID := normalizeIdentity(actorID)

	rep, err := getOrInitReputation(ctx, normalizedActorID, dimension, config)
	if err != nil {
		return nil, err
	}

	effectiveRep := applyDynamicDecay(rep, config)
	score := effectiveRep.Alpha / (effectiveRep.Alpha + effectiveRep.Beta)
	ci := calculateWilsonCI(effectiveRep.Alpha, effectiveRep.Beta, 0.95)

	return map[string]interface{}{
		"actorId":         normalizedActorID,
		"dimension":       dimension,
		"score":           score,
		"alpha":           effectiveRep.Alpha,
		"beta":            effectiveRep.Beta,
		"totalEvents":     rep.TotalEvents,
		"confidenceLow":   ci[0],
		"confidenceHigh":  ci[1],
		"lastTs":          rep.LastTs,
	}, nil
}

// GetRatingHistory retrieves all ratings for a given actor and dimension.
// GetRatingHistory retrieves ratings for an actor in a given dimension.
// REQUIRES CouchDB state database. Returns an error with LevelDB (the default).
// Enable CouchDB via CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS in peer config.
func (rc *ReputationContract) GetRatingHistory(
	ctx contractapi.TransactionContextInterface,
	actorID string,
	dimension string,
) ([]Rating, error) {
	normalizedActorID := normalizeIdentity(actorID)

	query := fmt.Sprintf(`{"selector":{"actorId":"%s","dimension":"%s"},"sort":[{"timestamp":"desc"}],"limit":100}`,
		normalizedActorID, dimension)

	resultsIterator, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer resultsIterator.Close()

	var ratings []Rating
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			continue
		}
		var rating Rating
		if err := json.Unmarshal(queryResult.Value, &rating); err != nil {
			continue
		}
		// Only include Rating objects (not RATER_ACTOR index records)
		if rating.RatingID != "" {
			ratings = append(ratings, rating)
		}
	}

	return ratings, nil
}

// GetRatingsByRater retrieves all ratings submitted by a specific rater.
// REQUIRES CouchDB state database. Returns an error with LevelDB (the default).
// Enable CouchDB via CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS in peer config.
func (rc *ReputationContract) GetRatingsByRater(
	ctx contractapi.TransactionContextInterface,
	raterID string,
) ([]Rating, error) {
	normalizedRaterID := normalizeIdentity(raterID)

	query := fmt.Sprintf(`{"selector":{"raterId":"%s"},"sort":[{"timestamp":"desc"}],"limit":100}`,
		normalizedRaterID)

	resultsIterator, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer resultsIterator.Close()

	var ratings []Rating
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			continue
		}
		var rating Rating
		if err := json.Unmarshal(queryResult.Value, &rating); err != nil {
			continue
		}
		if rating.RatingID != "" {
			ratings = append(ratings, rating)
		}
	}

	return ratings, nil
}

// GetDisputesByStatus retrieves all disputes with the given status.
// REQUIRES CouchDB state database. Returns an error with LevelDB (the default).
// Enable CouchDB via CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS in peer config.
func (rc *ReputationContract) GetDisputesByStatus(
	ctx contractapi.TransactionContextInterface,
	status string,
) ([]Dispute, error) {
	query := fmt.Sprintf(`{"selector":{"status":"%s"},"limit":100}`, status)

	resultsIterator, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer resultsIterator.Close()

	var disputes []Dispute
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			continue
		}
		var dispute Dispute
		if err := json.Unmarshal(queryResult.Value, &dispute); err != nil {
			continue
		}
		if dispute.DisputeID != "" {
			disputes = append(disputes, dispute)
		}
	}

	return disputes, nil
}

// GetActorsByDimension retrieves actors whose reputation score exceeds a threshold.
// REQUIRES CouchDB state database. Returns an error with LevelDB (the default).
// Enable CouchDB via CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS in peer config.
func (rc *ReputationContract) GetActorsByDimension(
	ctx contractapi.TransactionContextInterface,
	dimension string,
	minScoreStr string,
) ([]map[string]interface{}, error) {
	minScore, err := strconv.ParseFloat(minScoreStr, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid minScore: %v", err)
	}

	config, err := getConfig(ctx)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf(`{"selector":{"dimension":"%s"},"limit":1000}`, dimension)

	resultsIterator, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer resultsIterator.Close()

	var results []map[string]interface{}
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			continue
		}
		var rep Reputation
		if err := json.Unmarshal(queryResult.Value, &rep); err != nil {
			continue
		}
		if rep.ActorID == "" {
			continue
		}

		effectiveRep := applyDynamicDecay(&rep, config)
		score := effectiveRep.Alpha / (effectiveRep.Alpha + effectiveRep.Beta)

		if score >= minScore {
			results = append(results, map[string]interface{}{
				"actorId": rep.ActorID, "score": score,
				"totalEvents": rep.TotalEvents, "dimension": rep.Dimension,
			})
		}
	}

	return results, nil
}

// GetDispute retrieves a specific dispute record by ID.
func (rc *ReputationContract) GetDispute(
	ctx contractapi.TransactionContextInterface,
	disputeID string,
) (*Dispute, error) {
	disputeJSON, err := ctx.GetStub().GetState(disputeID)
	if err != nil || disputeJSON == nil {
		return nil, fmt.Errorf("dispute not found: %s", disputeID)
	}

	var dispute Dispute
	if err := json.Unmarshal(disputeJSON, &dispute); err != nil {
		return nil, fmt.Errorf("failed to unmarshal dispute: %v", err)
	}

	return &dispute, nil
}

// GetRating retrieves a specific rating record by ID.
func (rc *ReputationContract) GetRating(
	ctx contractapi.TransactionContextInterface,
	ratingID string,
) (*Rating, error) {
	ratingJSON, err := ctx.GetStub().GetState(ratingID)
	if err != nil || ratingJSON == nil {
		return nil, fmt.Errorf("rating not found: %s", ratingID)
	}

	var rating Rating
	if err := json.Unmarshal(ratingJSON, &rating); err != nil {
		return nil, fmt.Errorf("failed to unmarshal rating: %v", err)
	}

	return &rating, nil
}

// ============================================================================
// INTERNAL REPUTATION HELPERS
// ============================================================================

// updateReputation updates an actor's Beta distribution with a new weighted rating.
func (rc *ReputationContract) updateReputation(
	ctx contractapi.TransactionContextInterface,
	rating *Rating,
) error {
	config, err := getConfig(ctx)
	if err != nil {
		return err
	}

	rep, err := getOrInitReputation(ctx, rating.ActorID, rating.Dimension, config)
	if err != nil {
		return err
	}

	// Positive ratings increment Alpha; negative ratings increment Beta
	if rating.Value >= 0.5 {
		rep.Alpha += rating.Weight * rating.Value
	} else {
		rep.Beta += rating.Weight * (1.0 - rating.Value)
	}

	rep.TotalEvents++
	rep.LastTs = time.Now().Unix()

	repKey := fmt.Sprintf("REPUTATION:%s:%s", rating.ActorID, rating.Dimension)
	repJSON, err := json.Marshal(rep)
	if err != nil {
		return fmt.Errorf("failed to marshal reputation: %v", err)
	}

	if err := ctx.GetStub().PutState(repKey, repJSON); err != nil {
		return fmt.Errorf("failed to store reputation: %v", err)
	}

	score := rep.Alpha / (rep.Alpha + rep.Beta)
	payload := map[string]interface{}{
		"actorId": rating.ActorID, "dimension": rating.Dimension,
		"newScore": score, "totalEvents": rep.TotalEvents,
	}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("ReputationUpdated", payloadJSON)

	return nil
}

// calculateRaterWeight computes the influence of a rater based on their meta-reputation.
func (rc *ReputationContract) calculateRaterWeight(
	ctx contractapi.TransactionContextInterface,
	raterID string,
	baseDimension string,
) (float64, error) {
	config, err := getConfig(ctx)
	if err != nil {
		return config.MinRaterWeight, err
	}

	metaDimension, exists := config.MetaDimensions[baseDimension]
	if !exists {
		return config.MinRaterWeight, nil
	}

	rep, err := getOrInitReputation(ctx, raterID, metaDimension, config)
	if err != nil {
		return config.MinRaterWeight, err
	}

	effectiveRep := applyDynamicDecay(rep, config)
	metaScore := effectiveRep.Alpha / (effectiveRep.Alpha + effectiveRep.Beta)

	totalEvents := effectiveRep.Alpha + effectiveRep.Beta
	confidenceFactor := 1.0 + math.Sqrt(totalEvents/(totalEvents+10.0))

	weight := metaScore * confidenceFactor

	if weight < config.MinRaterWeight {
		weight = config.MinRaterWeight
	}
	if weight > config.MaxRaterWeight {
		weight = config.MaxRaterWeight
	}

	return weight, nil
}

// updateMetaReputation updates a rater's ability to rate others based on dispute outcome.
func (rc *ReputationContract) updateMetaReputation(
	ctx contractapi.TransactionContextInterface,
	raterID string,
	baseDimension string,
	wasCorrect bool,
) error {
	config, err := getConfig(ctx)
	if err != nil {
		return err
	}

	metaDimension, exists := config.MetaDimensions[baseDimension]
	if !exists {
		return fmt.Errorf("no meta-dimension for %s", baseDimension)
	}

	rep, err := getOrInitReputation(ctx, raterID, metaDimension, config)
	if err != nil {
		return err
	}

	if wasCorrect {
		rep.Alpha += 1.0
	} else {
		rep.Beta += 1.0
	}

	rep.LastTs = time.Now().Unix()
	rep.TotalEvents++

	repKey := fmt.Sprintf("REPUTATION:%s:%s", raterID, metaDimension)
	repJSON, err := json.Marshal(rep)
	if err != nil {
		return fmt.Errorf("failed to marshal metareputation: %v", err)
	}

	return ctx.GetStub().PutState(repKey, repJSON)
}

// reverseRating subtracts a rating's contribution from the actor's reputation.
func (rc *ReputationContract) reverseRating(
	ctx contractapi.TransactionContextInterface,
	ratingID string,
) error {
	ratingJSON, err := ctx.GetStub().GetState(ratingID)
	if err != nil || ratingJSON == nil {
		return fmt.Errorf("rating not found: %s", ratingID)
	}

	var rating Rating
	if err := json.Unmarshal(ratingJSON, &rating); err != nil {
		return fmt.Errorf("failed to unmarshal rating: %v", err)
	}

	config, _ := getConfig(ctx)

	rep, err := getOrInitReputation(ctx, rating.ActorID, rating.Dimension, config)
	if err != nil {
		return err
	}

	if rating.Value >= 0.5 {
		rep.Alpha -= rating.Weight * rating.Value
	} else {
		rep.Beta -= rating.Weight * (1.0 - rating.Value)
	}

	// Floor at the prior to prevent negative parameters
	if rep.Alpha < config.InitialAlpha {
		rep.Alpha = config.InitialAlpha
	}
	if rep.Beta < config.InitialBeta {
		rep.Beta = config.InitialBeta
	}
	if rep.TotalEvents > 0 {
		rep.TotalEvents--
	}

	repKey := fmt.Sprintf("REPUTATION:%s:%s", rating.ActorID, rating.Dimension)
	repJSON, err := json.Marshal(rep)
	if err != nil {
		return fmt.Errorf("failed to marshal reputation: %v", err)
	}

	return ctx.GetStub().PutState(repKey, repJSON)
}

// slashStake penalises a rater whose rating was overturned.
func (rc *ReputationContract) slashStake(
	ctx contractapi.TransactionContextInterface,
	raterID string,
) error {
	config, err := getConfig(ctx)
	if err != nil {
		return err
	}

	stake, err := getOrInitStake(ctx, raterID)
	if err != nil {
		return err
	}

	slashAmount := stake.Balance * config.SlashPercentage
	stake.Balance -= slashAmount
	stake.UpdatedAt = time.Now().Unix()

	stakeKey := fmt.Sprintf("STAKE:%s", raterID)
	stakeJSON, err := json.Marshal(stake)
	if err != nil {
		return fmt.Errorf("failed to marshal stake: %v", err)
	}

	if err := ctx.GetStub().PutState(stakeKey, stakeJSON); err != nil {
		return fmt.Errorf("failed to store stake: %v", err)
	}

	payload := map[string]interface{}{
		"raterId": raterID, "slashAmount": slashAmount, "newBalance": stake.Balance,
	}
	payloadJSON, _ := json.Marshal(payload)
	ctx.GetStub().SetEvent("StakeSlashed", payloadJSON)

	return nil
}

// ============================================================================
// RATING AGGREGATION BUFFER
// ============================================================================

// BufferRating validates a reputation rating and writes it to a unique
// per-transaction plain-string key, completely avoiding the REPUTATION hot key.
// Call FlushRatings to merge the buffer into the reputation record.
//
// Validation mirrors SubmitRating: stake check, self-rating prevention,
// dimension validation, and rater-weight calculation all execute inside this
// transaction so that the buffered rating carries a pre-computed weight.
//
// Parameters: actorID, dimension, valueStr [0,1], evidence (hash string)
// Returns: the source txID that uniquely identifies this pending entry
func (rc *ReputationContract) BufferRating(
	ctx contractapi.TransactionContextInterface,
	actorID string,
	dimension string,
	valueStr string,
	evidence string,
) (string, error) {
	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil || value < 0 || value > 1 {
		return "", fmt.Errorf("invalid value: must be between 0 and 1")
	}

	config, err := getConfig(ctx)
	if err != nil {
		return "", err
	}
	if !config.ValidDimensions[dimension] {
		return "", fmt.Errorf("invalid dimension: %s", dimension)
	}

	raterRawID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get rater ID: %v", err)
	}
	normalizedRaterID := normalizeIdentity(raterRawID)
	normalizedActorID := normalizeIdentity(actorID)

	if normalizedRaterID == normalizedActorID {
		return "", fmt.Errorf("self-rating is not allowed")
	}

	raterStake, err := getOrInitStake(ctx, normalizedRaterID)
	if err != nil {
		return "", fmt.Errorf("failed to get rater stake: %v", err)
	}
	if raterStake.Balance < config.MinStakeRequired {
		return "", fmt.Errorf("insufficient stake: have %.2f, require %.2f",
			raterStake.Balance, config.MinStakeRequired)
	}

	weight, err := rc.calculateRaterWeight(ctx, normalizedRaterID, dimension)
	if err != nil {
		return "", fmt.Errorf("failed to calculate rater weight: %v", err)
	}

	txID := ctx.GetStub().GetTxID()
	txTs, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return "", fmt.Errorf("failed to get tx timestamp: %v", err)
	}
	ts := txTs.AsTime().Unix()

	pending := PendingRating{
		PendingID:  txID,
		ActorID:    normalizedActorID,
		Dimension:  dimension,
		Value:      value,
		Weight:     weight,
		RaterID:    normalizedRaterID,
		Timestamp:  ts,
		SourceTxID: txID,
	}
	pendingJSON, err := json.Marshal(pending)
	if err != nil {
		return "", fmt.Errorf("failed to marshal pending rating: %v", err)
	}

	// Plain-string key is unique per txID — zero probability of MVCC conflict
	// regardless of how many concurrent callers rate the same actor+dimension.
	// Plain `:` separators avoid the \x00 null bytes produced by CreateCompositeKey,
	// which cause protobuf string-field marshaling panics in gRPC PutState.
	key := fmt.Sprintf("PENDING_RATING:%s:%s:%s", normalizedActorID, dimension, txID)
	if err := ctx.GetStub().PutState(key, pendingJSON); err != nil {
		return "", fmt.Errorf("failed to store pending rating: %v", err)
	}

	return txID, nil
}

// FlushRatings reads every buffered PendingRating for actorID+dimension,
// applies all deltas to the REPUTATION record in a single PutState, then
// deletes the consumed pending keys.
//
// Only one hot-key write occurs per flush call regardless of how many ratings
// were buffered, turning N×(MVCC conflict risk) into 1×(safe write).
//
// Decay is applied to the current reputation before accumulating the buffer,
// matching the behaviour of updateReputation.
//
// Can be called by any enrolled identity; the flush is idempotent if the
// buffer is empty.  Returns a JSON-marshalled FlushResult.
func (rc *ReputationContract) FlushRatings(
	ctx contractapi.TransactionContextInterface,
	actorID string,
	dimension string,
) (*FlushResult, error) {
	config, err := getConfig(ctx)
	if err != nil {
		return nil, err
	}
	if !config.ValidDimensions[dimension] {
		return nil, fmt.Errorf("invalid dimension: %s", dimension)
	}

	normalizedActorID := normalizeIdentity(actorID)

	// Load and decay the current reputation record
	rep, err := getOrInitReputation(ctx, normalizedActorID, dimension, config)
	if err != nil {
		return nil, fmt.Errorf("failed to load reputation: %v", err)
	}
	rep = applyDynamicDecay(rep, config)

	// Scan all pending ratings for this actor+dimension using a plain-key range.
	// `:` as separator, `;` (ASCII 59 = `:` + 1) as exclusive end bound.
	startKey := fmt.Sprintf("PENDING_RATING:%s:%s:", normalizedActorID, dimension)
	endKey   := fmt.Sprintf("PENDING_RATING:%s:%s;", normalizedActorID, dimension)
	iter, err := ctx.GetStub().GetStateByRange(startKey, endKey)
	if err != nil {
		return nil, fmt.Errorf("failed to query pending buffer: %v", err)
	}
	defer iter.Close()

	var toDelete []string
	flushed := 0
	var latestTs int64

	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate pending ratings: %v", err)
		}

		var p PendingRating
		if err := json.Unmarshal(kv.Value, &p); err != nil {
			continue // skip corrupted entries rather than aborting the flush
		}

		// Apply the same threshold logic as updateReputation
		if p.Value >= 0.5 {
			rep.Alpha += p.Weight * p.Value
		} else {
			rep.Beta += p.Weight * (1.0 - p.Value)
		}
		rep.TotalEvents++

		if p.Timestamp > latestTs {
			latestTs = p.Timestamp
		}

		toDelete = append(toDelete, kv.Key)
		flushed++
	}

	score := rep.Alpha / (rep.Alpha + rep.Beta)
	now := time.Now().Unix()

	if flushed == 0 {
		return &FlushResult{
			ActorID: normalizedActorID, Dimension: dimension,
			RatingsFlushed: 0,
			NewAlpha: rep.Alpha, NewBeta: rep.Beta, NewScore: score,
			FlushedAt: now,
		}, nil
	}

	if latestTs > rep.LastTs {
		rep.LastTs = latestTs
	}

	// Single hot-key write for all N buffered ratings
	repKey := fmt.Sprintf("REPUTATION:%s:%s", normalizedActorID, dimension)
	repJSON, err := json.Marshal(rep)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal reputation: %v", err)
	}
	if err := ctx.GetStub().PutState(repKey, repJSON); err != nil {
		return nil, fmt.Errorf("failed to write reputation: %v", err)
	}

	// Delete all consumed pending keys
	for _, k := range toDelete {
		if err := ctx.GetStub().DelState(k); err != nil {
			return nil, fmt.Errorf("failed to delete pending key %s: %v", k, err)
		}
	}

	evtPayload, _ := json.Marshal(map[string]interface{}{
		"actorId": normalizedActorID, "dimension": dimension,
		"flushed": flushed, "newScore": score,
	})
	ctx.GetStub().SetEvent("RatingsFlushed", evtPayload)

	return &FlushResult{
		ActorID: normalizedActorID, Dimension: dimension,
		RatingsFlushed: flushed,
		NewAlpha: rep.Alpha, NewBeta: rep.Beta, NewScore: score,
		FlushedAt: now,
	}, nil
}

// GetPendingCount returns the number of ratings currently in the buffer for
// a given actorID+dimension.  Zero means the buffer is clean (no pending flush
// needed).  Useful for monitoring and deciding when to trigger FlushRatings.
func (rc *ReputationContract) GetPendingCount(
	ctx contractapi.TransactionContextInterface,
	actorID string,
	dimension string,
) (int, error) {
	normalizedActorID := normalizeIdentity(actorID)

	startKey := fmt.Sprintf("PENDING_RATING:%s:%s:", normalizedActorID, dimension)
	endKey   := fmt.Sprintf("PENDING_RATING:%s:%s;", normalizedActorID, dimension)
	iter, err := ctx.GetStub().GetStateByRange(startKey, endKey)
	if err != nil {
		return 0, fmt.Errorf("failed to query pending buffer: %v", err)
	}
	defer iter.Close()

	count := 0
	for iter.HasNext() {
		if _, err := iter.Next(); err != nil {
			break
		}
		count++
	}
	return count, nil
}
