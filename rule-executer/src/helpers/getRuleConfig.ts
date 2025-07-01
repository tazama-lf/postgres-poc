import type { RuleConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { databaseManager, loggerService } from '..';

export const getRuleConfig = async (
  id: string,
  cfg: string,
): Promise<RuleConfig> => {
  loggerService.log('querying rule configuration');
  const config = await databaseManager.getRuleConfig(id, cfg);

  return config;
};
