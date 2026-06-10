alter table task_types add column sort_order integer default 0;

update task_types target
set sort_order = (
    select count(*)
    from task_types source
    where lower(source.name) < lower(target.name)
       or (lower(source.name) = lower(target.name) and source.id <= target.id)
);

alter table task_types alter column sort_order set not null;
