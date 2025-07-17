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
  - [Populating the database](#populating-the-database)
  - [Possible solutions](#possible-solutions)
- [Results and Findings](#results-and-findings)
  - [Successes](#successes)
  - [A (naive) performance run](#a-naive-performance-run)
    - [Load:](#load)
      - [Results (pre-optimisation):](#results-pre-optimisation)
      - [Arango:](#arango)
      - [Postgres (single instance)](#postgres-single-instance)
      - [Results (post-optimisation)](#results-post-optimisation)
- [Deployment Options](#deployment-options)
  - [A single instance with multiple databases](#a-single-instance-with-multiple-databases)
    - [Pros:](#pros)
    - [Cons:](#cons)
  - [Multiple instances with single databases](#multiple-instances-with-single-databases)
    - [Pros:](#pros-1)
    - [Cons:](#cons-1)
  - [Hybrid](#hybrid)
    - [Pros:](#pros-2)
- [Horizontally scaling the databases with Citus](#horizontally-scaling-the-databases-with-citus)
  - [Caveats](#caveats)
- [Monitoring](#monitoring)
- [TimescaleDB](#timescaledb)
  - [Setting up](#setting-up)
  - [Challenges](#challenges)
  - [Groundwork](#groundwork)
  - [Citus Interop](#citus-interop)

# Scope 

Replace ArangoDb in Tazama and test integration in a minimal sandbox with typology-028. Test out horizon 

# PoC Architecture 

Much like the ArangoDB counterpart - this POC deploys a single postgres instance and creates multiple databases to align with ArangoDB. 

# Transaction History 

Both Pacs008 and Pacs002 transactions are stored in a document column of type JSONB. In both cases, there are generated fields for CreDtTm, EndToEndId and MessageId. For Pacs008, there are two more additional generated columns: debtorAccountId and creditorAccountId. All the generated columns have not null constraints (safe, as TMS would have failed validation if any of them failed). 

## Indexed Columns 

- endToEndId (generated field) 
- messageId (generated field) 
- creDtTm (generated field) 

# Pseudonyms 

The pseudonyms database has 4 tables. The account and entity tables are a 1 to 1 translation of their Arango counterparts. The account_holder table in Arango has fields named to and from. This conflicts with SQL as those are reserved words. To improve readability and not deviate from SQL standards, these fields were renamed to destination and source respectively and they are foreign keys to the entity and account tables. They also form a composite key. 

The same issue is present in the transaction_relationship table as it also utilises columns labelled to and from. The same workaround of source and destination is applied. There are also generated columns for the following fields: 

- endToEndId 
- amt 
- ccy 
- msgId 
- creDtTm 
- txTp 
- txSts 
- pmtInfId 

A composite key is formed by (msgId, endToEndId, txTp, pmtInfId). 

## Indexed Columns 

- creDtTm (generated field) 
- txTp and endToEndId (generated field) 
- Additional indexes: 
- source, txtp, credttm 
- txsts 
- endtoendid 
- endtoendid, credttm 
- txtp = 'pacs.002.001.12' AND txsts = 'ACCC' 
- source, destination, txtp, txsts, credttm DESC (rule 024, 026) 

# Configuration 

## Network Map 

The network_map table just contains one column of type JSONB to store the configuration. 

## Rule 

The rule table contains two generated columns: the rule id and cfg in addition to the JSONB column to store a rule's configuration. A constraint is added for the pair of the fields to enforce uniqueness. 

### Indexed Columns 

- id and cfg (pair of generated fields – the combination must be unique) 

## Typology 

The typology table contains two generated columns: the typology id and cfg in addition to the JSONB column to store a typology's configuration. A constraint is added for the pair of the fields to enforce uniqueness. 

### Indexed Columns 

- id and cfg (pair of generated fields – the combination must be unique) 

# Evaluations 

This database has one table, transaction which has a generated column for the messageId. 

# Data Flow 

The applications remained unchanged for the most part - they call the frms-coe-lib which is what will write to PostgreSQL instead of ArangoDb. The first step is to replace ArangoDb with node-postgres (pg). ArangoDb also returns some results in an array, which needed additional logic to extract the inner value. This was handled for all the relevant library queries, but rule processors make their own queries, and this needed to be applied in all applicable scenarios. There is no need for "unwrapping for inner values” with the pg driver. However, as mentioned before - some fields were renamed to not conflict with SQL's keywords and this meant that the internal types/interfaces had a disconnect as those expected to and from fields. This presented two options:

 - Update the interfaces and rename the problematic fields 

 - Manually map the results to the fields already present in the interfaces  

The POC uses option 2 – the trade-off being accepting verbosity in some of the queries in place of a breaking change where interfaces are not what they looked like before. 

## Database Setup 

The database is deployed through docker-compose and initial migration scripts are run to create the separate databases. 

Take note that spinning up the docker stack will create the databases but not the tables. Those migrations need to be applied separately for each database. 

# Configuration 

The overall environment structure in the .env files is maintained. The only change needed is to introduce a database port variable since in the Arango driver, the port is supplied along with the DATABASE_URL. For pg, the port is used as a separate field. Since PostgreSQL runs on port 5432 by default, it can be omitted if the default configuration is used. 

Setting a database URL of localhost:5432 will evaluate to localhost:5432:5432 at runtime as the default port is added as well. Ensure that the DATABASE_URL is set only to localhost so it evaluates to localhost:5432 

For the rule-executor, all the rules have been collapsed into one project where the specific rule that will run will be determined by your environment. Only Typology 028 rules are included. To run rule-010, set the following variables in your environment: 

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

## Populating the database 

ArangoDb exposes a REST endpoint which Tazama uses to insert configuration. This not only includes creates, but updates as well. Not only is this limited to databases and tables, but constraints and indexes are also able to be updated through the REST API. For PostgreSQL, you would need to create those databases and tables manually. 

## Possible solutions 

There are open-source migration tools available for PostgreSQL such Flyway and Knex. 

They offer features like success/failure tracking, checksums and versioning which may be useful. However, in this POC – manually applying the migrations was more than sufficient as there is currently no need to keep track of checksums and versioning. 

For Kubernetes deployments, processors could also use init-containers or docker-entrypoints (which run migrations/seeding). 

Init Container (Kubernetes): 
  - A separate container that runs before your app starts 
Entrypoint Script (Docker/Docker Compose): 
  - A script that runs inside your app container before starting the server 

# Results and Findings 

## Successes 

- Replacing ArangoDb completely for a minimal typology-028 run. 
- Horizontally scaling a database (pseudonyms) with Citus 

## A (naive) performance run 

### Load: 

Simulating 20 (fixed) virtual users sending requests to the TMS-API continuously for 5 minutes 

#### Results (pre-optimisation): 

#### Arango: 

~3800 transactions being evaluated (TADP) on a local machine with all indexes created (1.3 FTPS) 

#### Postgres (single instance) 

~3300 with default connection pooling (1.1 FTPS) 

~3800 with pool size set to 100 (1.3 FTPS) 

#### Results (post-optimisation) 

~4300 transactions being evaluated (1.43 FTPS) 

After some additional indexes were added for the reported slow queries (024-028) 

```sql
create index idx_tr_source_txtp_credttm ON transaction_relationship (source, txtp, credttm); 
create index idx_tr_txsts ON transaction_relationship (txsts); 
create index idx_tr_endtoendid ON transaction_relationship (endtoendid); 
create index idx_tr_pacs002_accc ON transaction_relationship (endtoendid, credttm) 
    where txtp = 'pacs.002.001.12' AND txsts = 'ACCC'; 
create index idx_tr_dest_txtp_txsts_credttm_cover 
    on transaction_relationship (destination, txtp, txsts, credttm desc) 
    include (source); 
```

# Deployment Options 

## A single instance with multiple databases 

### Pros:  

- Easier to deploy and will maintain the structure that Arango had set in place making this option more familiar. 
- Maintenance is easier for the one process. 

### Cons: 

- A heavy query in one DB can affect others (slow rule queries may affect TMS performance) 

## Multiple instances with single databases 

Each instance is fully independent and manages its own set of databases 

### Pros: 

- Crashes don’t affect others. 
- Each instance can be tuned separately for workload differentials 
- Each instance can be scaled horizontally by Citus 

### Cons: 
- Each instance uses its own resources 

## Hybrid 

The pseudonyms database executes a lot of queries and could leverage tools like Citus for workload distribution. 

The transaction_history, evaluations and configurations databases can be kept on one instance and the pseudonyms database can be extracted and scaled horizontally independently. 

### Pros: 

Tazama has more reads than writes, specifically in the pseudonyms database – if this can be scaled horizontally independently, it would be a more efficient/optimal use of resources 

- The read-heavy database can be tuned for that use case 

- The write-heavy database can be tuned for that use case 

# Horizontally scaling the databases with Citus 

A sample docker compose file is available: Citus - GitHub. This can be used to automatically scale through docker itself: 

```sh
docker-compose -p citus up --scale worker=5 to spin up 5 more workers for your database. 
```

## Caveats 

Citus currently has partial support for foreign keys and generated columns. Most of the rule queries perform lookups on the `transaction_relationship` table and this has quite a bit of generated columns: these will have to be manually inserted instead, and the foreign key constraints removed: 

Tazama already enforces some of the constraints through application logic so these could be removed, and safety would still be present 
 
 ```sql
CREATE TABLE transaction_relationship ( 
    source varchar, 
    destination varchar, 
    endToEndId text, 
    amt numeric(18,2), 
    ccy varchar, 
    msgId varchar, 
    creDtTm text, 
    txTp varchar, 
    txSts varchar, 
    pmtInfId varchar, 
    transaction_relationship jsonb NOT NULL, 
    PRIMARY KEY (msgId, endToEndId, txTp, pmtInfId) 
); 
```

The insert statement for transaction_relationship in the coe-lib will have to be updated to populate these columns manually. 

In the citus co-ordinator node, we also need to mark this table as distributed by running this query: 

```sql
SELECT create_distributed_table('transaction_relationship', 'msgid'); 
```

That should cover the steps needed to register the pseudonyms database for Citus with support for horizontal scaling.  

Note: remember to update your `DATABASE_URL` to point to the citus coordinator for the processors that use pseudonyms: 

`PSEUDONYMS_DATABASE_URL`: localhost:15432 

(port set to 15432 to not conflict with the default 5432 which is service the other databases e.g transaction_history, evaluations, configuration) 

`PSEUDONYMS_DATABASE_NAME`: postgres 

# Monitoring 

PostgreSQL has a Prometheus exporter available for the community. Dashboard utilising this are also available for Grafana featuring visualisation for metrics and alerts for slow queries, maximum number of connections reached, high number of connections and queries per second 

For the ELK stack integration, Tazama leverages auto instrumentation for calls to ArangoDb. This allows us to be able to view APM spans for the Arango queries to see how they perform without needing to manually instrument each call. The pg driver has similar functionality for ELK which will allow database queries to each have spans visible from Kibana. 

# TimescaleDB

As an additional exercise, Timescale was used as the underlying database.  

## Setting up 

A single instance Timescale was used – hosting multiple databases. 

## Challenges 

Timescale functions around hypertables – virtual tables made from real PostgreSQL tables. These hypertables are partitioned across time. For Tazama, the `CreDtTm` field was used for partitioning. The first challenge encountered was that `CreDtTm` was a generated field (with a text type) - it is not possible to mutate (cast) a generated field - a PostgreSQL limitation. As a workaround, the `CreDtTm` column is no longer marked as generated, but explicitly inserted into the tables. 

The second challenge is how primary and foreign keys are applied to Timescale. The account_holder table in the pseudonyms database could not be marked as a hypertable (through the credttm column) as that table has an `id` as a primary key. Trying to create a hypertable from it would result in the error: 
> “cannot create a unique index without the column "credttm" (used in partitioning)” 

## Groundwork
If Timescale is selected as the database of choice, some groundwork needs to be done in order to map out the tables which will benefit the most from it.
In the pseudonyms database, there is also the `entity` table which is used as an example of triggering the index error. It has a `creDtTm` timestamp column. To mark this column as a hypertable, the primary key on `id` must be removed (as one example). This means that queries that insert to it which leverage "on conflict (id) do nothing" will also break and have to be revisited as `id` no longer has a unique constraint. Some application logic may be added to work around this

## Citus Interop

As of writing, Timescale and Citus function independently. So, one cannot have a Timescale hypertable that is horizontally scaled by Citus: https://github.com/timescale/timescaledb/issues/87 