- [Scope](#scope)
- [PoC Architecture](#poc-architecture)
  - [Transaction History](#transaction-history)
    - [Indexed Columns](#indexed-columns)
  - [Pseudonyms](#pseudonyms)
    - [Indexed Columns](#indexed-columns-1)
  - [Configuration](#configuration)
    - [Network Map](#network-map)
    - [Rule](#rule)
      - [Indexed Columns](#indexed-columns-2)
    - [Typology](#typology)
      - [Indexed Columns](#indexed-columns-3)
  - [Evaluations](#evaluations)
- [Data Flow](#data-flow)
- [Database Setup](#database-setup)
- [Configuration](#configuration-1)
- [Challenges and Issues](#challenges-and-issues)
  - [Technical Difficulties](#technical-difficulties)

# Scope
Replace ArangoDb in Tazama and test integration in a minimal sandbox with typology-028.

# PoC Architecture

Much like the ArangoDB counterpart - this POC deploys a single postgres instance and creates multiple databases to align with ArangoDB.

## [Transaction History](./../docker-stack/postgres-ddl/transaction_history.sql)
Both Pacs008 and Pacs002 transactions are stored in a `document` column of type `JSONB`. In both cases, there are generated fields for `CreDtTm`, `EndToEndId` and `MessageId`. For Pacs008, there are two more additional generated columns: `debtorAccountId` and `creditorAccountId`.
All the generated columns have not null constraints (safe, as TMS would have failed validation if any of them failed).

### Indexed Columns
- endToEndId (generated field)
- messageId (generated field)
- creDtTm (generated field)

## [Pseudonyms](./../docker-stack/postgres-ddl/pseudonyms.sql)
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

### Indexed Columns
- creDtTm (generated field)
- txTp and endToEndId (generated field)

## [Configuration](./../docker-stack/postgres-ddl/configuration.sql)

### Network Map
The `network_map` table just contains one column of type `JSONB` to store the configuration.

### Rule
The `rule` table contains two generated columns: the rule `id` and `cfg` in addition to the `JSONB` column to store a rule's configuration. A constraint is added for the pair of the fields to enforce uniqueness.

#### Indexed Columns
- id and cfg (pair of generated fields)

### Typology
The `typology` table contains two generated columns: the typology `id` and `cfg` in addition to the `JSONB` column to store a typology's configuration. A constraint is added for the pair of the fields to enforce uniqueness.

#### Indexed Columns
- id and cfg (pair of generated fields)

## [Evaluations](./../docker-stack/postgres-ddl/evaluations.sql)

This database has one table, `transaction` which has a generated column for the messageId.

# Data Flow
The applications remaind unchanged for the most part - they call the [frms-coe-lib] which is what will write to PostgreSQL instead of ArangoDb. The first step is to replace ArangoDb with [node-postgres (pg)](https://node-postgres.com). ArangoDb also returns some results in an array, which needed additional logic to extract the inner value. There is no need for this with the [pg] driver. However, as mentioned before - some fields were renamed so as to not conflict with SQL's keywords and this meant that the internal types/interfaces had a disconnect as those expected `to`
and `from` fields. As a word around, the objects are constructed manually from database results for those cases.

# Database Setup
The database is deployed through docker-compose and initial migration scripts are ran to create the separate databases.
> [!IMPORTANT]  
> Spinning up the docker stack will create the databases but not the tables. Those migrations need to be applied separately for each database.

# Configuration

The overall environment structure in the `.env` files is maintained. The only change needed is to introduce a database port variable as in the Arango driver, the port is supplied along with the database url. For [pg], the port is used as a separate field. However, as postgres runs on 5432 by default, it can be omitted if the default configuration is used.

> [!CAUTION]
> Setting a database URL of `localhost:5432` will actually evaluate to `localhost:5432:5432` at runtime as the default port is added as well. Ensure that the database url is set only to localhost so it evaluates to `localhost:5432`

For the rule-executor, all the rules have been collapsed into one project where the actual rule that will run will be determined by your environment. Only Typology 028 rules are included. To run rule-010, set the following variables in your environment:

```sh
FUNCTION_NAME='rule-010'
RULE_NAME='010'
```

Likewise, for rule-003:
```sh
FUNCTION_NAME='rule-003'
RULE_NAME='003'
```

From here on, build and run the applications:
```sh
cd TMS
npm i && npm run build
npm run start
```
In another shell:
```sh
cd rule-executer
npm i && npm run build
npm run start
```

# Challenges and Issues

## Technical Difficulties

A configurable database port involves adding in an additional variable to go through the validation process. 

[frms-coe-lib]: https://github.com/tazama-lf/frms-coe-lib
[pg]: https://node-postgres.com