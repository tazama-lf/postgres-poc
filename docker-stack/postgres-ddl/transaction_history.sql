create table pacs002 (
    id uuid primary key,
    document jsonb not null,
    createdAt timestamptz default now(),
    
    messageId text generated always as (
        document->'FIToFIPmtSts'->'GrpHdr'->>'MsgId'
    ) stored,

    endToEndId text generated always as (
        document->'FIToFIPmtSts'->'TxInfAndSts'->>'OrgnlEndToEndId'
    ) stored,

    constraint unique_msgid_e2eid_pacs002 unique (messageId, endToEndId),

    constraint message_id_not_null check (messageId is not null),
    constraint end_to_end_id_not_null check (endToEndId is not null)
);

create index idx_pacs002_msg_id on pacs002 (messageId);
create index idx_pacs002_end_to_end_id on pacs002 (endToEndId);

create table pacs008 (
    id uuid primary key,
    document jsonb not null,
    createdAt timestamptz default now(),

    messageId text generated always as (
        document->'FIToFICstmrCdtTrf'->'GrpHdr'->>'MsgId'
    ) stored,

    endToEndId text generated always as (
        document->'FIToFICstmrCdtTrf'->'CdtTrfTxInf'->'PmtId'->>'EndToEndId'
    ) stored,

    constraint unique_msgid_e2eid_pacs008 unique (messageId, endToEndId),
    constraint message_id_not_null check (messageId is not null),
    constraint end_to_end_id_not_null check (endToEndId is not null)
);

create index idx_pacs008_msg_id on pacs008 (messageId);
create index idx_pacs008_end_to_end_id on pacs008 (endToEndId);
