// SPDX-License-Identifier: Apache-2.0

import {
  type DatabaseManagerInstance,
  type LoggerService,
  type ManagerConfig,
} from '@tazama-lf/frms-coe-lib';
import {
  type RuleConfig,
  type RuleRequest,
  type RuleResult,
} from '@tazama-lf/frms-coe-lib/lib/interfaces';

export async function handleRule016(
  req: RuleRequest,
  determineOutcome: (
    value: number,
    ruleConfig: RuleConfig,
    ruleResult: RuleResult,
  ) => RuleResult,
  ruleRes: RuleResult,
  _loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<ManagerConfig>,
): Promise<RuleResult> {
  if (!ruleConfig?.config?.parameters) {
    throw new Error('Invalid config provided - parameters not provided');
  }
  if (!ruleConfig.config.parameters.maxQueryRange) {
    throw new Error(
      'Invalid config provided - maxQueryRange parameter not provided',
    );
  }
  if (!ruleConfig.config.bands) {
    throw new Error('Invalid config provided - bands not provided');
  }
  if (!req.DataCache || req.DataCache.cdtrAcctId == null) {
    throw new Error('Data Cache does not have required cdtrAcctId');
  }
  const creditorAccountId = req.DataCache.cdtrAcctId;
  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;

  const maxQueryRange: number = ruleConfig.config.parameters
    .maxQueryRange as number;

  const result = await databaseManager._pseudonymsDb.query(
    `
    select count (*) from transaction_relationship
      where source = $1 
        and txtp = $2
        and txsts = $3
        and (EXTRACT(EPOCH FROM $4::timestamptz - credttm::timestamptz) * 1000) <= $5;`,
    [
      creditorAccountId,
      'pacs.002.001.12',
      'ACCC',
      currentPacs002TimeFrame,
      maxQueryRange,
    ],
  );

  const count = Number(result.rows[0].count);

  if (count == null) {
    // 0 is a legal value
    throw new Error('Data error: irretrievable transaction history');
  }

  if (typeof count !== 'number') {
    throw new Error(
      'Data error: query result type mismatch - expected a number',
    );
  }

  return determineOutcome(count, ruleConfig, ruleRes);
}
