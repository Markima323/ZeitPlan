create table task_type_keywords (
    task_type_id bigint not null references task_types(id) on delete cascade,
    keyword_order integer not null,
    keyword varchar(120) not null,
    primary key (task_type_id, keyword_order)
);

insert into task_type_keywords (task_type_id, keyword_order, keyword)
select task_types.id, seeds.keyword_order, seeds.keyword
from task_types
join (
    values
        ('兴趣爱好', 0, '画画'),
        ('兴趣爱好', 1, 'Roman schreiben'),
        ('深度工作', 0, '开发'),
        ('深度工作', 1, 'Programieren'),
        ('深度工作', 2, 'Programmieren'),
        ('深度工作', 3, '修文'),
        ('深度工作', 4, '项目'),
        ('学习输入', 0, '德语'),
        ('学习输入', 1, '学'),
        ('学习输入', 2, '网课'),
        ('饮食休整', 0, '吃饭'),
        ('饮食休整', 1, '午休'),
        ('饮食休整', 2, 'Ausruhen'),
        ('饮食休整', 3, 'Kochen'),
        ('饮食休整', 4, 'Essen'),
        ('饮食休整', 5, 'Schlafen gehen')
) as seeds(type_name, keyword_order, keyword)
    on task_types.name = seeds.type_name;

insert into task_type_keywords (task_type_id, keyword_order, keyword)
select operation_type.id, seeds.keyword_order, seeds.keyword
from (
    select id
    from task_types
    where name in ('每日运营', '日常运营')
    order by case when name = '每日运营' then 0 else 1 end
    limit 1
) as operation_type
cross join (
    values
        (0, '每日计划'),
        (1, '洗澡'),
        (2, '洗衣服'),
        (3, '邮件'),
        (4, 'Zähne putzen'),
        (5, '地址'),
        (6, '纸箱'),
        (7, '写信'),
        (8, '快递'),
        (9, '退订')
) as seeds(keyword_order, keyword);
