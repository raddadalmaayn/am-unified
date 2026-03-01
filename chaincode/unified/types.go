package main

// ============================================================================
// PROVENANCE DATA STRUCTURES
// ============================================================================

// Asset represents the physical AM part being tracked on the blockchain.
type Asset struct {
	AssetID               string   `json:"assetID"`
	Owner                 string   `json:"owner"`
	CurrentLifecycleStage string   `json:"currentLifecycleStage"`
	HistoryTxIDs          []string `json:"historyTxIDs"`
}

// ProvenanceEvent holds all possible on-chain event data for a lifecycle stage.
type ProvenanceEvent struct {
	EventType               string `json:"eventType"`
	AgentID                 string `json:"agentID"`
	Timestamp               string `json:"timestamp"`
	OffChainDataHash        string `json:"offChainDataHash"`
	OnChainDataPayload      string `json:"onChainDataPayload"`
	MaterialType            string `json:"materialType"`
	MaterialBatchID         string `json:"materialBatchID"`
	SupplierID              string `json:"supplierID"`
	PrintJobID              string `json:"printJobID"`
	MachineID               string `json:"machineID"`
	MaterialUsedID          string `json:"materialUsedID"`
	PrimaryInspectionResult string `json:"primaryInspectionResult"`
	TestStandardApplied     string `json:"testStandardApplied"`
	FinalTestResult         string `json:"finalTestResult"`
	CertificateID           string `json:"certificateID"`
	LinkedRatingID          string `json:"linkedRatingID,omitempty"` // NEW: link to reputation rating
}

// HistoryResult wraps the provenance event array for query responses.
type HistoryResult struct {
	Events []ProvenanceEvent `json:"events"`
}

// ============================================================================
// REPUTATION DATA STRUCTURES
// ============================================================================

// SystemConfig holds all governable reputation system parameters.
type SystemConfig struct {
	MinStakeRequired float64 `json:"minStakeRequired"`
	DisputeCost      float64 `json:"disputeCost"`
	SlashPercentage  float64 `json:"slashPercentage"`

	DecayRate      float64 `json:"decayRate"`
	DecayPeriod    float64 `json:"decayPeriod"`
	InitialAlpha   float64 `json:"initialAlpha"`
	InitialBeta    float64 `json:"initialBeta"`
	MinRaterWeight float64 `json:"minRaterWeight"`
	MaxRaterWeight float64 `json:"maxRaterWeight"`

	ValidDimensions map[string]bool   `json:"validDimensions"`
	MetaDimensions  map[string]string `json:"metaDimensions"`

	Version     int   `json:"version"`
	LastUpdated int64 `json:"lastUpdated"`
}

// Reputation holds the Beta distribution parameters for an actor in a dimension.
type Reputation struct {
	ActorID     string  `json:"actorId"`
	Dimension   string  `json:"dimension"`
	Alpha       float64 `json:"alpha"`
	Beta        float64 `json:"beta"`
	TotalEvents int     `json:"totalEvents"`
	LastTs      int64   `json:"lastTs"`
}

// Rating represents a single peer rating event.
type Rating struct {
	RatingID  string  `json:"ratingId"`
	RaterID   string  `json:"raterId"`
	ActorID   string  `json:"actorId"`
	Dimension string  `json:"dimension"`
	Value     float64 `json:"value"`
	Weight    float64 `json:"weight"`
	Evidence  string  `json:"evidence"`
	Timestamp int64   `json:"timestamp"`
	TxID      string  `json:"txId"`
	// NEW: provenance linkage
	LinkedAssetID string `json:"linkedAssetId,omitempty"`
	LinkedEventTx string `json:"linkedEventTx,omitempty"`
}

// Stake represents an actor's financial commitment to the system.
type Stake struct {
	ActorID   string  `json:"actorId"`
	Balance   float64 `json:"balance"`
	Locked    float64 `json:"locked"`
	UpdatedAt int64   `json:"updatedAt"`
}

// Dispute represents a formal challenge to a reputation rating.
type Dispute struct {
	DisputeID       string `json:"disputeId"`
	RatingID        string `json:"ratingId"`
	InitiatorID     string `json:"initiatorId"`
	RaterID         string `json:"raterId"`
	ActorID         string `json:"actorId"`
	Dimension       string `json:"dimension"`
	Reason          string `json:"reason"`
	Status          string `json:"status"` // pending, upheld, overturned
	ArbitratorID    string `json:"arbitratorId"`
	ArbitratorNotes string `json:"arbitratorNotes"`
	CreatedAt       int64  `json:"createdAt"`
	ResolvedAt      int64  `json:"resolvedAt"`
}

// ============================================================================
// INTEGRATION DATA STRUCTURES
// ============================================================================

// ReputationGate defines minimum reputation requirements for a lifecycle event type.
type ReputationGate struct {
	EventType    string  `json:"eventType"`
	Dimension    string  `json:"dimension"`
	MinScore     float64 `json:"minScore"`
	MinEvents    int     `json:"minEvents"` // minimum number of ratings required (confidence gate)
	Enforced     bool    `json:"enforced"`
	LastUpdated  int64   `json:"lastUpdated"`
}

// ActorReputationSummary holds reputation scores across all dimensions for one actor.
type ActorReputationSummary struct {
	ActorID     string                     `json:"actorId"`
	Dimensions  map[string]DimensionScore  `json:"dimensions"`
	TotalRatings int                       `json:"totalRatings"`
	GeneratedAt  int64                     `json:"generatedAt"`
}

// DimensionScore holds a computed score with confidence bounds.
type DimensionScore struct {
	Score       float64   `json:"score"`
	Alpha       float64   `json:"alpha"`
	Beta        float64   `json:"beta"`
	TotalEvents int       `json:"totalEvents"`
	ConfidenceLow  float64 `json:"confidenceLow"`
	ConfidenceHigh float64 `json:"confidenceHigh"`
}

// PartTrustReport is the comprehensive unified report for a single AM part.
type PartTrustReport struct {
	AssetID        string               `json:"assetId"`
	CurrentStage   string               `json:"currentStage"`
	ProvenanceHistory []ProvenanceEvent `json:"provenanceHistory"`
	ActorTrustScores  map[string]ActorReputationSummary `json:"actorTrustScores"`
	LinkedRatings  []Rating             `json:"linkedRatings"`
	GeneratedAt    int64                `json:"generatedAt"`
}

// ProvenanceRepLink links a provenance event transaction to a reputation rating.
type ProvenanceRepLink struct {
	AssetID   string `json:"assetId"`
	EventTxID string `json:"eventTxId"`
	RatingID  string `json:"ratingId"`
	EventType string `json:"eventType"`
	RatedActor string `json:"ratedActor"`
	CreatedAt  int64  `json:"createdAt"`
}

// SupplyChainMetrics contains system-wide aggregate metrics.
type SupplyChainMetrics struct {
	TotalAssets       int                      `json:"totalAssets"`
	ActiveActors      int                      `json:"activeActors"`
	TotalRatings      int                      `json:"totalRatings"`
	TotalDisputes     int                      `json:"totalDisputes"`
	LinkedEvents      int                      `json:"linkedEvents"` // events with reputation links
	GeneratedAt       int64                    `json:"generatedAt"`
}
