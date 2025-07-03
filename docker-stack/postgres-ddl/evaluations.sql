create table transaction (
    transaction jsonb not null,
    messageId text generated always as (
        transaction->'transaction'->'FIToFIPmtSts'->'GrpHdr'->>'MsgId'
    ) stored
);
