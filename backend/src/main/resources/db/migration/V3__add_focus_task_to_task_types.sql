alter table task_types
    add column focus_task boolean not null default true;

update task_types
set focus_task = false
where name in ('日常运营', '饮食休整', '身体状态');
