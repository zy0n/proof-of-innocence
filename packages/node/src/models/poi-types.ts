import { SnarkProof, TXIDVersion } from '@railgun-community/shared-models';

export enum POIEventType {
  Shield = 'Shield',
  Transact = 'Transact',
  LegacyTransact = 'LegacyTransact',
}

export type POIEventShield = {
  type: POIEventType.Shield;
  blindedCommitment: string;
  commitmentHash: string;
};

export type POIEventTransact = {
  type: POIEventType.Transact;
  blindedCommitments: string[];
  proof: SnarkProof;
};

export type POIEventLegacyTransact = {
  type: POIEventType.LegacyTransact;
  blindedCommitment: string;
};

export type POIEvent =
  | POIEventShield
  | POIEventTransact
  | POIEventLegacyTransact;

export type SignedPOIEvent = {
  index: number;
  blindedCommitmentStartingIndex: number;
  blindedCommitments: string[];
  signature: string;

  // Only for Transact non-legacy events
  proof: Optional<SnarkProof>;
};

export type SignedBlockedShield = {
  commitmentHash: string;
  blindedCommitment: string;
  blockReason: Optional<string>;
  signature: string;
};

export type SubmitPOIEventParams = {
  txidVersion: TXIDVersion;
  signedPOIEvent: SignedPOIEvent;
  listKey: string;
};

export type SubmitValidatedTxidAndMerklerootParams = {
  txidVersion: TXIDVersion;
  txidIndex: number;
  merkleroot: string;
  signature: string;
  listKey: string;
};

export type RemoveTransactProofParams = {
  txidVersion: TXIDVersion;
  firstBlindedCommitment: string;
  signature: string;
  listKey: string;
};

export type GetLegacyTransactProofsParams = {
  txidVersion: TXIDVersion;
  bloomFilterSerialized: string;
};

export type GetPOIListEventRangeParams = {
  txidVersion: TXIDVersion;
  listKey: string;
  startIndex: number;
  endIndex: number;
};
