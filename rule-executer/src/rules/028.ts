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

export async function handleRule028(
  req: RuleRequest,
  determineOutcome: (
    value: number,
    ruleConfig: RuleConfig,
    ruleResult: RuleResult,
  ) => RuleResult,
  ruleRes: RuleResult,
  loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<ManagerConfig>,
): Promise<RuleResult> {
  // Guard statements to throw errors early
  if (!ruleConfig.config.bands) {
    throw new Error('Invalid config provided - bands not provided');
  }

  const endToEndId = req.transaction.FIToFIPmtSts.TxInfAndSts.OrgnlEndToEndId;

  const res = await databaseManager._transactionHistory.query(
    `
    select document->'FIToFICstmrCdtTrf'->'CdtTrfTxInf'->'Dbtr'->'Id'->'PrvtId'->'DtAndPlcOfBirth'->'BirthDt' as birthdate from pacs008
      where endtoendid = $1`,
    [endToEndId],
  );

  const dateOfBirthRes = [res.rows[0]['birthdate']] as Array<[string]>;

  // Validates only for YYYY-MM-DD format
  // const validDateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (
    !dateOfBirthRes ||
    !dateOfBirthRes[0] ||
    dateOfBirthRes[0].length <= 0 ||
    typeof dateOfBirthRes[0][0] !== 'string' // ||
    // !validDateRegex.test(dateOfBirthRes[0][0]) --> uhh, we kinda have the time as well
  ) {
    throw new Error('Data error: query result type mismatch - expected date');
  }

  // Determine age of debtor relative to when transaction occurred
  const transactionDate = req.transaction.FIToFIPmtSts.GrpHdr.CreDtTm;
  const debtorAge = calculateAge(dateOfBirthRes[0][0], transactionDate);

  ruleRes = determineOutcome(debtorAge, ruleConfig, ruleRes);

  return ruleRes;
}

function calculateAge(dateOfBirth: string, relativeToDate: string): number {
  const fromDate = new Date(relativeToDate);
  const birthDate = new Date(dateOfBirth);

  let age = fromDate.getFullYear() - birthDate.getFullYear();
  const months = fromDate.getMonth() - birthDate.getMonth();

  if (
    months < 0 ||
    (months === 0 && fromDate.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}
