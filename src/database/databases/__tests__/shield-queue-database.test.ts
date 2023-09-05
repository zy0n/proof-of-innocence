import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client';
import { ShieldQueueDatabase } from '../shield-queue-database';
import { ShieldData } from '@railgun-community/wallet';
import {
  ShieldQueueDBItem,
  ShieldStatus,
} from '../../../models/database-types';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let db: ShieldQueueDatabase;

describe('shield-queue-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new ShieldQueueDatabase(networkName);
    await db.createCollectionIndices();
  });

  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should insert items and query from shield queue database', async () => {
    const now = Date.now();

    // No shields in queue to begin
    await expect(db.getPendingShields(now)).to.eventually.deep.equal([]);

    const pendingShield1: ShieldData = {
      txid: '0x1234',
      hash: '0x5678',
      timestamp: now,
    };
    await db.insertPendingShield(pendingShield1);

    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const pendingShield2: ShieldData = {
      txid: '0x9876',
      hash: '0x5432',
      timestamp: tenDaysAgo,
    };
    await db.insertPendingShield(pendingShield2);

    const shieldQueueItem2: ShieldQueueDBItem = {
      txid: '0x9876',
      hash: '0x5432',
      timestamp: tenDaysAgo,
      status: ShieldStatus.Pending,
      lastValidatedTimestamp: null,
    };
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await expect(db.getPendingShields(sevenDaysAgo)).to.eventually.deep.equal([
      shieldQueueItem2,
    ]);
  });
});
