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
    amtUnit bigint not null,
    amtCcy varchar(3) not null,
    amtNanos integer not null,
    creDtTm timestamptz not null,
    endToEndId varchar not null check (trim(endToEndId) <> ''),
    msgId varchar not null check (trim(msgId) <> ''),
    pmtInfId varchar not null check (trim(pmtInfId) <> ''),
    txTp varchar not null check (trim(txTp) <> ''),
    lat float8,
    lon float8,
    txSts varchar,
    primary key (msgId, endToEndId, txTp, pmtInfId)
);
