create table network_map (
    id uuid primary key,
    configuration jsonb not null
);

create table typology (
    uuid uuid primary key,
    configuration jsonb not null,
    typologyId text generated always as (
        configuration->>'typologyId'
    ) stored,
    typologyCfg text generated always as (
        configuration->>'typologyCfg'
    ) stored,
    unique (typologyId, typologyCfg)
);

create table rule (
    uuid uuid primary key,
    configuration jsonb not null,
    ruleId text generated always as (
        configuration->>'id'
    ) stored,
    ruleCfg text generated always as (
        configuration->>'cfg'
    ) stored,
    unique (ruleId, ruleCfg)
);
