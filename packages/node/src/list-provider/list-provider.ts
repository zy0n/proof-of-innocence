import {
  NetworkName,
  delay,
  isDefined,
} from '@railgun-community/shared-models';
import { networkForName } from '../config/general';
import { ShieldData } from '@railgun-community/wallet';
import debug from 'debug';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { Config } from '../config/config';
import { ShieldQueueDBItem, ShieldStatus } from '../models/database-types';
import { StatusDatabase } from '../database/databases/status-database';
import { getNewShieldsFromWallet } from '../engine/wallet';
import {
  getTransactionReceipt,
  getTimestampFromTransactionReceipt,
} from '../rpc-providers/tx-receipt';
import { Constants } from '../config/constants';
import { ListProviderPOIEventQueue } from './list-provider-poi-event-queue';
import { ListProviderPOIEventUpdater } from './list-provider-poi-event-updater';
import { POIEventShield, POIEventType } from '../models/poi-types';
import { ListProviderBlocklist } from './list-provider-blocklist';
import { hoursAgo } from '../util/time-ago';

export type ListProviderConfig = {
  name: string;
  description: string;
  queueShieldsOverrideDelayMsec?: number;
  validateShieldsOverrideDelayMsec?: number;
};

// 20 minutes
const DEFAULT_QUEUE_SHIELDS_DELAY_MSEC = 20 * 60 * 1000;

// 30 seconds
const DEFAULT_VALIDATE_SHIELDS_DELAY_MSEC = 30 * 1000;

const dbg = debug('poi:list-provider');

export abstract class ListProvider {
  listKey: string;

  protected abstract config: ListProviderConfig;

  constructor(listKey: string) {
    dbg(`LIST KEY: ${listKey}`);

    this.listKey = listKey;

    ListProviderPOIEventQueue.init(listKey);
    ListProviderPOIEventUpdater.init(listKey);
    ListProviderBlocklist.init(listKey);
  }

  protected abstract shouldAllowShield(
    networkName: NetworkName,
    txid: string,
    fromAddressLowercase: string,
    timestamp: number,
  ): Promise<{ shouldAllow: boolean; blockReason?: string }>;

  startPolling() {
    if (!isDefined(this.listKey)) {
      throw new Error('Must call init on ListProvider before polling.');
    }
    dbg(
      `List ${this.config.name} polling for new shields and validating queued shields...`,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runQueueShieldsPoller();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runValidateQueuedShieldsPoller();

    ListProviderPOIEventQueue.startPolling();
    ListProviderPOIEventUpdater.startPolling();
  }

  private async runQueueShieldsPoller() {
    // Run for each network in series.
    for (let i = 0; i < Config.NETWORK_NAMES.length; i++) {
      const networkName = Config.NETWORK_NAMES[i];
      await this.queueNewShields(networkName);
    }

    await delay(
      this.config.queueShieldsOverrideDelayMsec ??
        DEFAULT_QUEUE_SHIELDS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runQueueShieldsPoller();
  }

  private async runValidateQueuedShieldsPoller() {
    // Run for each network in series.
    for (let i = 0; i < Config.NETWORK_NAMES.length; i++) {
      const networkName = Config.NETWORK_NAMES[i];
      await this.validateNextQueuedShieldBatch(networkName);
    }

    await delay(
      this.config.queueShieldsOverrideDelayMsec ??
        DEFAULT_VALIDATE_SHIELDS_DELAY_MSEC,
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runValidateQueuedShieldsPoller();
  }

  async queueNewShields(networkName: NetworkName): Promise<void> {
    const statusDB = new StatusDatabase(networkName);
    const status = await statusDB.getStatus();
    const network = networkForName(networkName);
    const startingBlock = status?.latestBlockScanned ?? network.deploymentBlock;

    const newShields: ShieldData[] = await getNewShieldsFromWallet(
      networkName,
      startingBlock,
    );

    dbg(
      `[${networkName}] Attempting to insert ${newShields.length} pending shields`,
    );

    await Promise.all(
      newShields.map((shieldData) =>
        this.queueShieldSafe(networkName, shieldData),
      ),
    );

    if (newShields.length > 0) {
      const lastShieldScanned = newShields[newShields.length - 1];
      const latestBlockScanned = lastShieldScanned.blockNumber;
      await statusDB.saveStatus(latestBlockScanned);
    }
  }

  private async queueShieldSafe(
    networkName: NetworkName,
    shieldData: ShieldData,
  ) {
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      await shieldQueueDB.insertPendingShield(shieldData);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(
        `[${networkName}] Error queuing shield on ${networkName}: ${err.message}`,
      );
      dbg(shieldData);
    }
  }

  private getMaxTimestampForValidation() {
    return hoursAgo(Constants.HOURS_SHIELD_PENDING_PERIOD);
  }

  async validateNextQueuedShieldBatch(networkName: NetworkName): Promise<void> {
    const endTimestamp = this.getMaxTimestampForValidation();
    let pendingShields: ShieldQueueDBItem[];
    try {
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      const limit = 100;
      pendingShields = await shieldQueueDB.getPendingShields(
        endTimestamp,
        limit,
      );
      if (pendingShields.length === 0) {
        return;
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error getting queued shields on ${networkName}: ${err.message}`);
      return;
    }

    dbg(
      `[${networkName}] Validating ${pendingShields.length} pending shields...`,
    );

    await Promise.all(
      pendingShields.map((shieldData) =>
        this.validateShield(networkName, shieldData, endTimestamp),
      ),
    );
  }

  private async validateShield(
    networkName: NetworkName,
    shieldDBItem: ShieldQueueDBItem,
    endTimestamp: number,
  ) {
    const { txid } = shieldDBItem;
    try {
      const txReceipt = await getTransactionReceipt(networkName, txid);
      const timestamp = await getTimestampFromTransactionReceipt(
        networkName,
        txReceipt,
      );
      if (timestamp > endTimestamp) {
        // Shield is too new to validate
        throw new Error('Invalid timestamp');
      }

      const { shouldAllow, blockReason } = await this.shouldAllowShield(
        networkName,
        txid,
        txReceipt.from.toLowerCase(),
        timestamp,
      );

      if (shouldAllow) {
        // Allow - add POIEvent
        const poiEventShield: POIEventShield = {
          type: POIEventType.Shield,
          commitmentHash: shieldDBItem.commitmentHash,
          blindedCommitment: shieldDBItem.blindedCommitment,
        };
        ListProviderPOIEventQueue.queueUnsignedPOIShieldEvent(
          networkName,
          poiEventShield,
        );
      } else {
        // Block - add BlockedShield
        await ListProviderBlocklist.addBlockedShield(
          networkName,
          shieldDBItem,
          blockReason,
        );
      }

      // Update status in DB
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      await shieldQueueDB.updateShieldStatus(
        shieldDBItem,
        shouldAllow ? ShieldStatus.Allowed : ShieldStatus.Blocked,
      );
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error validating queued shield on ${networkName}: ${err.message}`);
      dbg(shieldDBItem);
    }
  }
}
