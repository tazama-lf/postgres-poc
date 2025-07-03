create table account (
    id varchar primary key
);

create table entity (
    id varchar primary key,
    creDtTm timestamptz not null
);

create table account_holder (
    source varchar references entity(id),
    destination varchar references account(id),
    creDtTm timestamptz not null,
    primary key (source, destination)
);

create table transaction_relationship (
    source varchar references account(id),
    destination varchar references account(id),
    transaction_relationship jsonb not null,

    endToEndId text generated always as (
        transaction_relationship->>'EndToEndId'
    ) stored,

    amt numeric(18,2) generated always as (
        (transaction_relationship->>'Amt')::numeric(18,2)
    ) stored,

    ccy varchar generated always as (
        transaction_relationship->>'Ccy'
    ) stored,

    msgId varchar generated always as (
        transaction_relationship->>'MsgId'
    ) stored,

    -- cast to timestamptz when querying
    creDtTm text generated always as (
        transaction_relationship->>'CreDtTm'
    ) stored,

    txTp varchar generated always as (
        transaction_relationship->>'TxTp'
    ) stored,

    txSts varchar generated always as (
        transaction_relationship->>'TxSts'
    ) stored,

    pmtInfId varchar generated always as (
        transaction_relationship->>'PmtInfId'
    ) stored,

    primary key (msgId, endToEndId, txTp, pmtInfId)
);

create index idx_tr_e2d_txtp on transaction_relationship (endToEndId, txTp);
create index idx_tr_cre_dt_tm on transaction_relationship (creDtTm);
