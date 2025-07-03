create table network_map (
    configuration jsonb not null
);

create table typology (
    configuration jsonb not null,
    typologyId text generated always as (
        configuration->>'id'
    ) stored,
    typologyCfg text generated always as (
        configuration->>'cfg'
    ) stored,
    unique (typologyId, typologyCfg)
);

create table rule (
    configuration jsonb not null,
    ruleId text generated always as (
        configuration->>'id'
    ) stored,
    ruleCfg text generated always as (
        configuration->>'cfg'
    ) stored,
    unique (ruleId, ruleCfg)
);
