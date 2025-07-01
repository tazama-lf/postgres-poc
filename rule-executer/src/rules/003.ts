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
import { unwrap } from '@tazama-lf/frms-coe-lib/lib/helpers/unwrap';
// @ts-ignore

export const handleRule003 = async (
  req: RuleRequest,
  determineOutcome: (
    value: number,
    ruleConfig: RuleConfig,
    ruleResult: RuleResult,
  ) => RuleResult,
  ruleResult: RuleResult,
  _loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<ManagerConfig>,
): Promise<RuleResult> => {
  if (!ruleConfig?.config?.bands) {
    throw new Error('Invalid config provided - bands not provided');
  }

  if (!ruleConfig.config.exitConditions) {
    throw new Error('Invalid config provided - exitConditions not provided');
  }

  if (!req.DataCache.cdtrAcctId) {
    throw new Error('DataCache object not retrievable');
  }

  const creditorAccountId = req.DataCache.cdtrAcctId;
  const endToEndId = req.transaction.FIToFIPmtSts.TxInfAndSts.OrgnlEndToEndId;
  const currentPacs002TimeFrame = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;

const pool = await databaseManager._pseudonymsDb?.query(`
    WITH newestSentpacs008 as (
        SELECT MAX(creDtTm::timestamptz) as newestPain FROM transaction_relationship
        WHERE source = $1
          AND txTp = 'pacs.008.001.10'
          AND endToEndId != $2
          AND creDtTm::timestamptz < $3::timestamptz
    ),
    allSuccessfulPacs002 as (
      select endToEndId from transaction_relationship
      where source = $1
      and txtp = 'pacs.002.001.12'
      and txsts = 'ACCC'
      and endToEndId != $2
      and creDtTm::timestamptz < $3::timestamptz
      order by creDtTm::timestamptz desc
      limit 1
    ),
    newestReceivedpacs008 AS (
    SELECT MAX(creDtTm::timestamptz) AS newestSuccessfulPacs
    FROM transaction_relationship
    WHERE txtp = 'pacs.008.001.10'
      AND endToEndId = (SELECT endToEndId FROM allSuccessfulPacs002)
    )
    SELECT GREATEST(
        (SELECT newestPain FROM newestSentpacs008),
        (SELECT newestSuccessfulPacs FROM newestReceivedpacs008)
    ) AS result;
  `,[
    creditorAccountId,
    endToEndId,
    new Date(currentPacs002TimeFrame),
  ]
  );

  if (!pool.rows.count) {
    const reason =
      ruleConfig.config.exitConditions.find(
        (exit) => exit.subRuleRef === '.x01',
      )?.reason ??
      'No verifiable creditor account activity detected and no exit condition in config';
    return { ...ruleResult, subRuleRef: '.x01', reason };
  }

  const results = pool.rows.map((value: {result: string})=> value.result);

  const timeStampOldestSuccessfulpacs008Edge = results[0];

  if (!new Date(timeStampOldestSuccessfulpacs008Edge).getTime()) {
    throw new Error(
      'Data error: query result type mismatch - expected DATE_TIME',
    );
  }

  const timeStamp = new Date(timeStampOldestSuccessfulpacs008Edge).getTime();
  const currentTime = Date.now();

  const timeDifferenceInMs = currentTime - timeStamp;

  return determineOutcome(timeDifferenceInMs, ruleConfig, ruleResult);
};
