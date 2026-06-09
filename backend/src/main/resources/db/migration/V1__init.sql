create table task_types (
    id bigserial primary key,
    name varchar(120) not null unique,
    icon_key varchar(80) not null,
    color_hex varchar(16) not null,
    description varchar(500) not null default '',
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table daily_plans (
    id bigserial primary key,
    plan_date date not null unique,
    season_mode varchar(16) not null,
    day_start_local_time time not null,
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table plan_tasks (
    id bigserial primary key,
    plan_id bigint not null references daily_plans(id) on delete cascade,
    task_type_id bigint references task_types(id) on delete set null,
    title varchar(240) not null,
    duration_minutes integer not null,
    order_index integer not null
);

create table dice_rolls (
    id bigserial primary key,
    plan_id bigint not null references daily_plans(id) on delete cascade,
    phase varchar(16) not null,
    value integer not null,
    reward_unlocked boolean not null,
    message varchar(500) not null,
    created_at timestamp with time zone not null default current_timestamp
);

create index idx_plan_tasks_plan_id_order_index on plan_tasks(plan_id, order_index);
create index idx_dice_rolls_plan_id_created_at on dice_rolls(plan_id, created_at);
