import {
  NETWORK_CONFIG,
  NetworkName,
  TransactProofData,
  GetTransactProofsParams,
  GetBlockedShieldsParams,
  NodeStatusAllNetworks,
  ValidateTxidMerklerootParams,
  SubmitTransactProofParams,
  TXIDVersion,
  SubmitLegacyTransactProofParams,
  LegacyTransactProofData,
  SubmitSingleCommitmentProofsParams,
  SingleCommitmentProofsData,
} from '@railgun-community/shared-models';
import axios, { AxiosError } from 'axios';
import {
  GetLegacyTransactProofsParams,
  GetPOIListEventRangeParams,
  RemoveTransactProofParams,
  SignedBlockedShield,
  SignedPOIEvent,
  SubmitPOIEventParams,
  SubmitValidatedTxidAndMerklerootParams,
} from '../models/poi-types';
import debug from 'debug';
import {
  getListPublicKey,
  signRemoveProof,
  signValidatedTxidMerkleroot,
} from '../util/ed25519';
import { isListProvider } from '../config/general';

const dbg = debug('poi:request');

export class POINodeRequest {
  private static getNodeRouteURL = (url: string, route: string): string => {
    return `${url}/${route}`;
  };

  private static async getRequest<ResponseData>(
    url: string,
  ): Promise<ResponseData> {
    try {
      const { data }: { data: ResponseData } = await axios.get(url);
      return data;
    } catch (err) {
      if (!(err instanceof AxiosError)) {
        throw err;
      }
      const errMessage = err.message;
      dbg(`ERROR ${url} - ${errMessage}`);
      throw new Error(errMessage);
    }
  }

  private static async postRequest<Params, ResponseData>(
    url: string,
    params: Params,
  ): Promise<ResponseData> {
    try {
      const { data }: { data: ResponseData } = await axios.post(url, params);
      return data;
    } catch (err) {
      if (!(err instanceof AxiosError)) {
        throw err;
      }
      const errMessage = `${err.message}: ${err.response?.data}`;
      dbg(`ERROR ${url} - ${errMessage}`);
      throw new Error(errMessage);
    }
  }

  static validateRailgunTxidMerkleroot = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    tree: number,
    index: number,
    merkleroot: string,
  ): Promise<boolean> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `validate-txid-merkleroot/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
    const isValid = await POINodeRequest.postRequest<
      ValidateTxidMerklerootParams,
      boolean
    >(url, {
      txidVersion,
      tree,
      index,
      merkleroot,
    });
    return isValid;
  };

  static getNodeStatusAllNetworks = async (
    nodeURL: string,
  ): Promise<NodeStatusAllNetworks> => {
    const route = `node-status-v2`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const nodeStatusAllNetworks =
      await POINodeRequest.getRequest<NodeStatusAllNetworks>(url);
    return nodeStatusAllNetworks;
  };

  static getPOIListEventRange = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    startIndex: number,
    endIndex: number,
  ): Promise<SignedPOIEvent[]> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `poi-events/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const poiEvents = await POINodeRequest.postRequest<
      GetPOIListEventRangeParams,
      SignedPOIEvent[]
    >(url, {
      txidVersion,
      listKey,
      startIndex,
      endIndex,
    });
    return poiEvents;
  };

  static getFilteredTransactProofs = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    bloomFilterSerialized: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `transact-proofs/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const transactProofs = await POINodeRequest.postRequest<
      GetTransactProofsParams,
      TransactProofData[]
    >(url, {
      listKey,
      txidVersion,
      bloomFilterSerialized,
    });
    return transactProofs;
  };

  static getFilteredLegacyTransactProofs = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    bloomFilterSerialized: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `legacy-transact-proofs/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const transactProofs = await POINodeRequest.postRequest<
      GetLegacyTransactProofsParams,
      LegacyTransactProofData[]
    >(url, {
      txidVersion,
      bloomFilterSerialized,
    });
    return transactProofs;
  };

  static getFilteredBlockedShields = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    bloomFilterSerialized: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `blocked-shields/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const signedBlockedShields = await POINodeRequest.postRequest<
      GetBlockedShieldsParams,
      SignedBlockedShield[]
    >(url, {
      listKey,
      txidVersion,
      bloomFilterSerialized,
    });
    return signedBlockedShields;
  };

  static submitTransactProof = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    transactProofData: TransactProofData,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `submit-transact-proof/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    await POINodeRequest.postRequest<SubmitTransactProofParams, void>(url, {
      txidVersion,
      listKey,
      transactProofData,
    });
  };

  static submitLegacyTransactProof = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `submit-legacy-transact-proofs/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    await POINodeRequest.postRequest<SubmitLegacyTransactProofParams, void>(
      url,
      {
        txidVersion,
        listKeys: [],
        legacyTransactProofDatas: [legacyTransactProofData],
      },
    );
  };

  static submitSingleCommitmentProof = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    singleCommitmentProofsData: SingleCommitmentProofsData,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `submit-single-commitment-proofs/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    await POINodeRequest.postRequest<SubmitSingleCommitmentProofsParams, void>(
      url,
      {
        txidVersion,
        singleCommitmentProofsData,
      },
    );
  };

  static removeTransactProof = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `remove-transact-proof/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    if (!isListProvider()) {
      // Cannot sign without list.
      return;
    }

    const signature = await signRemoveProof(
      blindedCommitmentsOut,
      railgunTxidIfHasUnshield,
    );

    await POINodeRequest.postRequest<RemoveTransactProofParams, void>(url, {
      txidVersion,
      listKey,
      blindedCommitmentsOut,
      railgunTxidIfHasUnshield,
      signature,
    });
  };

  static submitPOIEvent = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `submit-poi-event/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    await POINodeRequest.postRequest<SubmitPOIEventParams, void>(url, {
      txidVersion,
      listKey,
      signedPOIEvent,
    });
  };

  static submitValidatedTxidAndMerkleroot = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    txidIndex: number,
    merkleroot: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `submit-validated-txid/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const listKey = await getListPublicKey();

    if (!isListProvider()) {
      // Cannot sign without list.
      return;
    }

    const signature = await signValidatedTxidMerkleroot(txidIndex, merkleroot);

    await POINodeRequest.postRequest<
      SubmitValidatedTxidAndMerklerootParams,
      void
    >(url, {
      txidVersion,
      txidIndex,
      merkleroot,
      signature,
      listKey,
    });
  };
}
