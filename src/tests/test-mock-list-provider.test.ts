/* eslint-disable @typescript-eslint/no-unused-vars */

import { NetworkName } from '@railgun-community/shared-models';
import { ListProvider } from '../list-provider/list-provider';
import { MOCK_EXCLUDED_ADDRESS_1 } from './mocks.test';

const EXCLUDED_ADDRESSES_LOWERCASE: string[] = [MOCK_EXCLUDED_ADDRESS_1];

export class TestMockListProvider extends ListProvider {
  protected async shouldAllowShield(
    networkName: NetworkName,
    txid: string,
    fromAddressLowercase: string,
    timestamp: number,
  ): Promise<boolean> {
    if (EXCLUDED_ADDRESSES_LOWERCASE.includes(fromAddressLowercase)) {
      return false;
    }
    return true;
  }
}
