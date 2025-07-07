# Changes Applied to Tazama

## PoC Architecture

Much like the ArangoDB counterpart - this POC deploys a single postgres instance and creates multiple databases to align with ArangoDB.

### [Transaction History](./../docker-stack/postgres-ddl/transaction_history.sql)
Both Pacs008 and Pacs002 transactions are stored in a `document` column of type `JSONB`. In both cases, there are generated fields for `CreDtTm`, `EndToEndId` and `MessageId`. For Pacs008, there are two more additional generated columns: `debtorAccountId` and `creditorAccountId`.
All the generated columns have not null constraints (safe, as TMS would have failed validation if any of them failed).

#### Indexed Columns
- endToEndId (generated field)
- messageId (generated field)
- creDtTm (generated field)

### [Pseudonyms](./../docker-stack/postgres-ddl/pseudonyms.sql)
The pseudonyms database has 4 tables. The `account` and `entity` tables are a 1 to 1 translation of their Arango counterparts. The `account_holder` table in Arango has fields named `to` and `from`. This conflicts with SQL as those are reserved words. To improve readability and not deviate from SQL standards, these fields were renamed to `destination` and `source` respectively and they are foreign keys to the `entity` and `account` tables. They also form a composite key.

The same issue is present in the `transaction_relationship` table as it also utilises `to` and `from`. The same workaround of `source` and `destination` is applied. There are also generated columns for the following fields:

- endToEndId
- amt
- ccy
- msgId
- creDtTm
- txTp
- txSts
- pmtInfId

A composite key is formed by (msgId, endToEndId, txTp, pmtInfId).

#### Indexed Columns
- creDtTm (generated field)
- txTp and endToEndId (generated field)

### [Configuration](./../docker-stack/postgres-ddl/configuration.sql)

#### Network Map
The `network_map` table just contains one column of type `JSONB` to store the configuration.

#### Rule
The `rule` table contains two generated columns: the rule `id` and `cfg` in addition to the `JSONB` column to store a rule's configuration. A constraint is added for the pair of the fields to enforce uniqueness.

##### Indexed Columns
- id and cfg (pair of generated fields)

#### Typology
The `typology` table contains two generated columns: the typology `id` and `cfg` in addition to the `JSONB` column to store a typology's configuration. A constraint is added for the pair of the fields to enforce uniqueness.

##### Indexed Columns
- id and cfg (pair of generated fields)

### [Evaluations](./../docker-stack/postgres-ddl/evaluations.sql)

This database has one table, `transaction` which has a generated column for the messageId.

### Deployment
The database is deployed through docker-compose and initial migration scripts are ran to create the separate databases.



The platform still uses multiple databases as the ArangoDB counterpart.

Most of the database interactions in Tazama are in the [frms-coe-lib]


[frms-coe-lib]: https://github.com/tazama-lf/frms-coe-lib