create table network_map (
    id serial primary key,
    configuration jsonb not null
);

create table typology (
    id serial primary key,
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
    id serial primary key,
    configuration jsonb not null,
    ruleId text generated always as (
        configuration->>'id'
    ) stored,
    ruleCfg text generated always as (
        configuration->>'cfg'
    ) stored,
    unique (ruleId, ruleCfg)
);
