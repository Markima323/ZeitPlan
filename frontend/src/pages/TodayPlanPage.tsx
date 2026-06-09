import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import type { DailyPlanResponse, SeasonMode, TaskTypeResponse } from "../api/types";
import { buildScheduleBlocks, formatMinutes, parseClock, todayIsoDate } from "../lib/schedule";
import { TaskIcon } from "../lib/taskIcons";

export function TodayPlanPage({
  seasonMode,
  onSeasonSync,
}: {
  seasonMode: SeasonMode;
  onSeasonSync: (value: SeasonMode) => void;
}) {
  const [planDate] = useState(todayIsoDate());
  const [plan, setPlan] = useState<DailyPlanResponse | null>(null);
  const [taskTypes, setTaskTypes] = useState<TaskTypeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTodayPlan() {
      try {
        const [nextPlan, nextTaskTypes] = await Promise.all([
          apiClient.getPlan(planDate),
          apiClient.getTaskTypes(),
        ]);

        if (!cancelled) {
          setPlan(nextPlan);
          setTaskTypes(nextTaskTypes);
          setFeedback(null);
          setIsLoading(false);
          onSeasonSync(nextPlan.seasonMode);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback(error instanceof Error ? error.message : "读取今日计划失败");
          setIsLoading(false);
        }
      }
    }

    void loadTodayPlan();

    return () => {
      cancelled = true;
    };
  }, [onSeasonSync, planDate]);

  const schedule = useMemo(
    () =>
      buildScheduleBlocks(
        plan?.tasks ?? [],
        taskTypes,
        plan?.dayStartLocalTime.slice(0, 5) ?? "10:00",
        seasonMode,
      ),
    [plan, seasonMode, taskTypes],
  );

  const spotlight = useMemo(() => {
    const taskBlocks = schedule.blocks.filter((block) => !block.breakBlock);
    if (taskBlocks.length === 0) {
      return null;
    }

    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    const activeOrNext = taskBlocks.find((block) => parseClock(block.localEndTime) > currentMinutes);
    const currentBlock = activeOrNext ?? taskBlocks.at(-1) ?? null;
    if (!currentBlock) {
      return null;
    }

    const isCurrent =
      parseClock(currentBlock.localStartTime) <= currentMinutes &&
      currentMinutes < parseClock(currentBlock.localEndTime);
    const isDone = !activeOrNext;

    return {
      block: currentBlock,
      mode: isDone ? "done" : isCurrent ? "current" : "next",
    } as const;
  }, [schedule.blocks]);

  const summaryLine = useMemo(() => {
    return `今日共 ${plan?.tasks.length ?? 0} 个任务 · 专注 ${formatMinutes(schedule.focusMinutes)} · 休息 ${formatMinutes(schedule.breakMinutes)}`;
  }, [plan?.tasks.length, schedule.breakMinutes, schedule.focusMinutes]);

  const focusBlockId = spotlight && spotlight.mode !== "done" ? spotlight.block.id : null;

  return (
    <div className="page-stack">
      {feedback ? <div className="feedback-banner">{feedback}</div> : null}

      <section className="content-panel focus-panel today-focus-shell">
        <div className="today-focus-copy">
          <div>
            <p className="eyebrow">Today</p>
            <h1 className="today-title">今日计划</h1>
            <p className="today-meta">
              {planDate} · 德国本地时间 / 北京时间对照 · {seasonMode === "SUMMER" ? "夏令时" : "冬令时"}
            </p>
          </div>

          <p className="today-summary-line">{summaryLine}</p>

          <div className="today-actions">
            <Link className="primary-button" to="/planner">
              编辑今日计划
            </Link>
          </div>
        </div>

        <aside className="today-spotlight-card">
          <span className="next-task-kicker">
            {spotlight?.mode === "current" ? "当前进行中" : spotlight?.mode === "done" ? "今日状态" : "下一项"}
          </span>
          {spotlight ? (
            spotlight.mode === "done" ? (
              <>
                <strong className="next-task-title">今天的计划已经完成</strong>
                <p className="next-task-time">现在适合回顾今天的节奏，或者直接去调整下一天的安排。</p>
              </>
            ) : (
              <>
                <strong className="next-task-title">
                  {spotlight.block.typeName} · {spotlight.block.title}
                </strong>
                <p className="next-task-time">
                  {spotlight.block.localStartTime}–{spotlight.block.localEndTime} 本地时间
                </p>
                <p className="next-task-time muted">
                  {spotlight.block.beijingStartTime}–{spotlight.block.beijingEndTime} 北京时间
                </p>
              </>
            )
          ) : (
            <>
              <strong className="next-task-title">今天还没有安排任务</strong>
              <p className="next-task-time">先去日程规划页建立今天最重要的几件事，首页就会自动聚焦到下一项。</p>
            </>
          )}
        </aside>
      </section>

      <section className="content-panel secondary-panel today-table-panel">
        {isLoading ? <div className="empty-state">正在加载今日计划...</div> : null}

        {!isLoading && schedule.blocks.length === 0 ? (
          <>
            <div className="empty-state">今天还没有已保存的日计划。</div>
            <div className="soft-warning">
              可以前往 <Link to="/planner">日程规划页</Link> 创建或编辑今天的安排。
            </div>
          </>
        ) : null}

        {!isLoading && schedule.blocks.length > 0 ? (
          <div className="schedule-card today-schedule-card">
            <div className="today-table-header">
              <div>
                <h2>完整日程</h2>
                <p>完整安排放在第二层，方便先看重点，再向下核对细节。</p>
              </div>
            </div>

            <div className="table-shell">
              <table className="schedule-table today-plan-table">
                <thead>
                  <tr>
                    <th>本地开始</th>
                    <th>本地结束</th>
                    <th>北京开始</th>
                    <th>北京结束</th>
                    <th>任务内容</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.blocks.map((block) => (
                    <tr
                      key={block.id}
                      className={[
                        block.breakBlock ? "break-row today-break-row" : "",
                        block.id === focusBlockId ? "focus-row" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <td>{block.localStartTime}</td>
                      <td>{block.localEndTime}</td>
                      <td>{block.beijingStartTime}</td>
                      <td>{block.beijingEndTime}</td>
                      <td>
                        {block.breakBlock ? (
                          <span className="today-break-cell">
                            <span className="break-pill">休息</span>
                            <small>{block.title}</small>
                          </span>
                        ) : (
                          <span className="task-cell">
                            <span className="task-icon-wrap" style={{ backgroundColor: `${block.typeColor}18` }}>
                              <TaskIcon iconKey={block.typeIcon} className="task-icon" />
                            </span>
                            <span>
                              <strong>{block.title}</strong>
                              <small>{block.typeName}</small>
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
