export class QueryLimits {
  // Max number of commitments for a single transaction
  static readonly GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS = 13;

  static readonly GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS = 100;

  static readonly MAX_EVENT_QUERY_RANGE_LENGTH = 500;

  static readonly PROOF_MEMPOOL_SYNCED_ITEMS = 500;

  static readonly BLOCKED_SHIELDS_SYNCED_ITEMS = 50;
}
