update daily_plans
set day_start_local_time = '10:00:00'
where day_start_local_time = '09:00:00'
  and not exists (
    select 1
    from plan_tasks
    where plan_tasks.plan_id = daily_plans.id
  );
