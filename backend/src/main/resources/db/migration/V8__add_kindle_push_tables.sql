create table kindle_devices (
    id varchar(48) primary key,
    owner_user_id varchar(80) not null,
    name varchar(120) not null,
    device_token_hash varchar(120) not null unique,
    current_screen_id varchar(48),
    current_version integer not null default 0,
    last_seen_at timestamp with time zone,
    last_ip varchar(120),
    last_width integer,
    last_height integer,
    last_battery_percentage integer,
    last_rssi varchar(80),
    last_device_identifier varchar(120),
    last_model varchar(120),
    last_fw_version varchar(120),
    enabled boolean not null default true,
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

create table kindle_screens (
    id varchar(48) primary key,
    device_id varchar(48) not null references kindle_devices(id) on delete cascade,
    owner_user_id varchar(80) not null,
    source_type varchar(80) not null,
    source_ref varchar(160) not null,
    title varchar(240),
    version integer not null,
    image_path varchar(160) not null,
    image_bytes bytea not null,
    image_width integer not null,
    image_height integer not null,
    render_status varchar(40) not null,
    error_message varchar(1000),
    created_at timestamp with time zone not null default current_timestamp,
    rendered_at timestamp with time zone,
    expires_at timestamp with time zone
);

create table kindle_push_events (
    id varchar(48) primary key,
    device_id varchar(48) not null references kindle_devices(id) on delete cascade,
    owner_user_id varchar(80) not null,
    event_type varchar(80) not null,
    version integer not null,
    screen_id varchar(48) references kindle_screens(id) on delete set null,
    status varchar(40) not null,
    error_message varchar(1000),
    created_at timestamp with time zone not null default current_timestamp,
    delivered_at timestamp with time zone
);

create index idx_kindle_devices_owner_user_id on kindle_devices(owner_user_id);
create index idx_kindle_screens_device_version on kindle_screens(device_id, version);
create index idx_kindle_push_events_device_created_at on kindle_push_events(device_id, created_at);
