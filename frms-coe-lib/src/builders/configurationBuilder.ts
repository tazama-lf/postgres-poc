// SPDX-License-Identifier: Apache-2.0

import NodeCache from 'node-cache';
import { type Typology } from '../interfaces';
import { type LocalCacheConfig, type DatabaseManagerType, type DBConfig } from '../services/dbManager';
import { Pool } from 'pg';

export async function configurationBuilder(
  manager: DatabaseManagerType,
  configurationConfig: DBConfig,
  cacheConfig?: LocalCacheConfig,
): Promise<void> {
  manager._configuration = new Pool({
    host: configurationConfig.url,
    database: configurationConfig.databaseName,
    user: configurationConfig.user,
    password: configurationConfig.password,
  });

  manager.setupConfig = configurationConfig;
  manager.nodeCache = cacheConfig?.localCacheEnabled ? new NodeCache() : undefined;

  manager.getRuleConfig = async (ruleId: string, cfg: string, limit?: number) => {
    const cacheKey = `${ruleId}_${cfg}`;
    if (cacheConfig?.localCacheEnabled ?? false) {
      const cacheVal = manager.nodeCache?.get(cacheKey);
      if (cacheVal) return await Promise.resolve(cacheVal);
    }
    const db = manager._configuration;

    const toReturn = await db?.query(
      `
      select
        configuration
      from
        rule
      where
          ruleId = $1
        and
          ruleCfg = $2
      ${limit ? 'limit $3' : ''}`,
      [ruleId, cfg, limit],
    );

    if (cacheConfig?.localCacheEnabled && toReturn && toReturn.rows && toReturn.rows.length === 1) {
      manager.nodeCache?.set(cacheKey, toReturn, cacheConfig?.localCacheTTL ?? 3000);
    }
    return toReturn?.rows[0].configuration;
  };

  manager.getTypologyConfig = async (typology: Typology) => {
    const cacheKey = `${typology.id}_${typology.cfg}`;
    if (cacheConfig?.localCacheEnabled ?? false) {
      const cacheVal = manager.nodeCache?.get(cacheKey);
      if (cacheVal) return await Promise.resolve(cacheVal);
    }
    const db = manager._configuration;

    const toReturn = await db?.query(
      `
      select
        configuration
      from
        typology
      where
          typologyId = $1
        and
          typologyCfg = $2
      `,
      [typology.id, typology.cfg],
    );

    if (cacheConfig?.localCacheEnabled && toReturn && toReturn.rows && toReturn.rows.length === 1) {
      manager.nodeCache?.set(cacheKey, toReturn, cacheConfig?.localCacheTTL ?? 3000);
    }
    return toReturn?.rows[0].configuration;
  };

  manager.getNetworkMap = async () => {
    const db = manager._configuration;
    const toReturn = await db?.query(
      `
      select
        configuration
      from
        network_map
      where
          configuration->'active' = $1
      `,
      [true],
    );
    return toReturn?.rows[0].configuration;
  };
}
