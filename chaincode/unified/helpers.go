package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// ============================================================================
// IDENTITY HELPERS
// ============================================================================

// normalizeIdentity extracts a canonical, short identifier from the full
// Fabric X.509 distinguished name returned by GetID(). This prevents
// comparison failures due to whitespace or ordering differences.
func normalizeIdentity(identity string) string {
	// If it looks like a base64-encoded DER certificate, decode it first
	decoded, err := base64.StdEncoding.DecodeString(identity)
	if err == nil {
		identity = string(decoded)
	}

	// If there are no "::" separators it is not a Fabric X.509 DN — return as-is.
	// This covers plain actor names passed directly as function arguments (e.g. "buyer1").
	if !strings.Contains(identity, "::") {
		return identity
	}

	// Extract CN= value as the canonical ID
	parts := strings.Split(identity, "::")
	for _, part := range parts {
		if strings.Contains(part, "CN=") {
			subParts := strings.Split(part, ",")
			for _, sub := range subParts {
				sub = strings.TrimSpace(sub)
				if strings.HasPrefix(sub, "CN=") {
					return strings.TrimPrefix(sub, "CN=")
				}
			}
		}
	}

	// Fallback: hash the full identity for a deterministic short key
	h := sha256.Sum256([]byte(identity))
	return fmt.Sprintf("%x", h[:8])
}

// isAdmin checks whether the invoking identity holds the admin role.
func isAdmin(ctx contractapi.TransactionContextInterface) bool {
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return false
	}
	normalizedClientID := normalizeIdentity(clientID)

	adminListJSON, err := ctx.GetStub().GetState("ADMIN_LIST")
	if err != nil {
		// Fail closed on ledger read errors — do not grant admin on transient failures
		return false
	}
	if adminListJSON == nil {
		// Bootstrap: if no admin list exists yet, the caller becomes admin
		// (closed by InitConfig seeding ADMIN_LIST on first call)
		return true
	}

	var admins map[string]bool
	if err := json.Unmarshal(adminListJSON, &admins); err != nil {
		return false
	}

	return admins[normalizedClientID]
}

// isArbitrator checks whether the invoking identity holds the arbitrator role.
func isArbitrator(ctx contractapi.TransactionContextInterface) bool {
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return false
	}
	normalizedClientID := normalizeIdentity(clientID)

	arbitratorListJSON, err := ctx.GetStub().GetState("ARBITRATOR_LIST")
	if err != nil || arbitratorListJSON == nil {
		return false
	}

	var arbitrators map[string]bool
	if err := json.Unmarshal(arbitratorListJSON, &arbitrators); err != nil {
		return false
	}

	return arbitrators[normalizedClientID]
}

// ============================================================================
// SYSTEM CONFIG HELPERS
// ============================================================================

// getConfig loads the system configuration from the ledger.
func getConfig(ctx contractapi.TransactionContextInterface) (*SystemConfig, error) {
	configJSON, err := ctx.GetStub().GetState("SYSTEM_CONFIG")
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %v", err)
	}
	if configJSON == nil {
		return nil, fmt.Errorf("system not initialized: call InitConfig first")
	}

	var config SystemConfig
	if err := json.Unmarshal(configJSON, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %v", err)
	}

	return &config, nil
}

// validateConfig ensures all config values are within acceptable ranges.
func validateConfig(config *SystemConfig) error {
	if config.MinStakeRequired < 0 {
		return fmt.Errorf("minStakeRequired must be non-negative")
	}
	if config.DisputeCost < 0 {
		return fmt.Errorf("disputeCost must be non-negative")
	}
	if config.SlashPercentage < 0 || config.SlashPercentage > 1 {
		return fmt.Errorf("slashPercentage must be between 0 and 1")
	}
	if config.DecayRate <= 0 || config.DecayRate > 1 {
		return fmt.Errorf("decayRate must be between 0 (exclusive) and 1")
	}
	if config.DecayPeriod <= 0 {
		return fmt.Errorf("decayPeriod must be positive")
	}
	if config.InitialAlpha <= 0 || config.InitialBeta <= 0 {
		return fmt.Errorf("initialAlpha and initialBeta must be positive")
	}
	if config.MinRaterWeight <= 0 || config.MaxRaterWeight <= 0 {
		return fmt.Errorf("rater weights must be positive")
	}
	if config.MinRaterWeight >= config.MaxRaterWeight {
		return fmt.Errorf("minRaterWeight must be less than maxRaterWeight")
	}
	return nil
}

// ============================================================================
// REPUTATION STATE HELPERS
// ============================================================================

// getOrInitReputation loads an existing reputation record or creates a fresh one.
func getOrInitReputation(
	ctx contractapi.TransactionContextInterface,
	actorID string,
	dimension string,
	config *SystemConfig,
) (*Reputation, error) {
	repKey := fmt.Sprintf("REPUTATION:%s:%s", actorID, dimension)
	repJSON, err := ctx.GetStub().GetState(repKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read reputation: %v", err)
	}

	if repJSON != nil {
		var rep Reputation
		if err := json.Unmarshal(repJSON, &rep); err != nil {
			return nil, fmt.Errorf("failed to unmarshal reputation: %v", err)
		}
		return &rep, nil
	}

	// Initialize with uninformative Beta(α₀, β₀) prior
	return &Reputation{
		ActorID:     actorID,
		Dimension:   dimension,
		Alpha:       config.InitialAlpha,
		Beta:        config.InitialBeta,
		TotalEvents: 0,
		LastTs:      time.Now().Unix(),
	}, nil
}

// getOrInitStake loads an existing stake or creates an empty one.
func getOrInitStake(
	ctx contractapi.TransactionContextInterface,
	actorID string,
) (*Stake, error) {
	stakeKey := fmt.Sprintf("STAKE:%s", actorID)
	stakeJSON, err := ctx.GetStub().GetState(stakeKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read stake: %v", err)
	}

	if stakeJSON != nil {
		var stake Stake
		if err := json.Unmarshal(stakeJSON, &stake); err != nil {
			return nil, fmt.Errorf("failed to unmarshal stake: %v", err)
		}
		return &stake, nil
	}

	return &Stake{
		ActorID:   actorID,
		Balance:   0,
		Locked:    0,
		UpdatedAt: time.Now().Unix(),
	}, nil
}

// ============================================================================
// REPUTATION MATH HELPERS
// ============================================================================

// applyDynamicDecay applies exponential time-decay to a reputation record,
// pulling the score back toward the uninformative prior as time passes.
func applyDynamicDecay(rep *Reputation, config *SystemConfig) *Reputation {
	if rep.LastTs == 0 {
		return rep
	}

	elapsed := float64(time.Now().Unix()-rep.LastTs) / config.DecayPeriod
	if elapsed <= 0 {
		return rep
	}

	decayFactor := math.Pow(config.DecayRate, elapsed)

	// Decay toward the prior (InitialAlpha, InitialBeta)
	effectiveRep := &Reputation{
		ActorID:     rep.ActorID,
		Dimension:   rep.Dimension,
		Alpha:       config.InitialAlpha + (rep.Alpha-config.InitialAlpha)*decayFactor,
		Beta:        config.InitialBeta + (rep.Beta-config.InitialBeta)*decayFactor,
		TotalEvents: rep.TotalEvents,
		LastTs:      rep.LastTs,
	}

	// Floor at the prior to prevent negative values
	if effectiveRep.Alpha < config.InitialAlpha {
		effectiveRep.Alpha = config.InitialAlpha
	}
	if effectiveRep.Beta < config.InitialBeta {
		effectiveRep.Beta = config.InitialBeta
	}

	return effectiveRep
}

// calculateWilsonCI computes the Wilson score confidence interval for a
// Beta distribution parameterised by (alpha, beta) at the given confidence level.
func calculateWilsonCI(alpha, beta, confidence float64) [2]float64 {
	n := alpha + beta
	p := alpha / n

	// z-score for the confidence level (95% → z ≈ 1.96)
	z := 1.96
	if confidence == 0.99 {
		z = 2.576
	} else if confidence == 0.90 {
		z = 1.645
	}

	denominator := 1 + (z*z)/n
	centre := (p + (z*z)/(2*n)) / denominator
	margin := (z * math.Sqrt(p*(1-p)/n+(z*z)/(4*n*n))) / denominator

	return [2]float64{
		math.Max(0, centre-margin),
		math.Min(1, centre+margin),
	}
}

// ============================================================================
// ID GENERATION HELPERS
// ============================================================================

// generateRatingID creates a deterministic rating key from its constituents.
func generateRatingID(raterID, actorID, dimension string, timestamp int64) string {
	data := fmt.Sprintf("%s:%s:%s:%d", raterID, actorID, dimension, timestamp)
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("RATING:%x", hash[:16])
}

// generateDisputeID creates a deterministic dispute key.
func generateDisputeID(ratingID, initiatorID string, timestamp int64) string {
	data := fmt.Sprintf("%s:%s:%d", ratingID, initiatorID, timestamp)
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("DISPUTE:%x", hash[:16])
}
