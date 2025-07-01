create table transaction (
    uuid uuid primary key,
    transaction jsonb not null,
    messageId text generated always as (
        transaction->'transaction'->'FIToFIPmtSts'->'GrpHdr'->>'MsgId'
    ) stored
);
