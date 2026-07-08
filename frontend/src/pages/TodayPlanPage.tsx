import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import type { DailyPlanResponse, KindleDevice, SeasonMode, TaskTypeResponse } from "../api/types";
import { buildScheduleBlocks, formatMinutes, parseClock, todayIsoDate } from "../lib/schedule";
import { TaskIcon } from "../lib/taskIcons";

function formatKindleTime(value: string | null) {
  if (!value) {
    return "暂无推送";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hasOnlineKindle(devices: KindleDevice[]) {
  return devices.some((device) => (
    device.lastSeenAt &&
    Date.now() - new Date(device.lastSeenAt).getTime() < 2 * 60 * 1000
  ));
}

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
  const [kindleDevices, setKindleDevices] = useState<KindleDevice[]>([]);
  const [isKindleLoading, setIsKindleLoading] = useState(true);
  const [kindleLoadFailed, setKindleLoadFailed] = useState(false);
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

  useEffect(() => {
    let cancelled = false;

    async function loadKindleDevices() {
      setIsKindleLoading(true);
      try {
        const nextKindleDevices = await apiClient.getKindleDevices();
        if (!cancelled) {
          setKindleDevices(nextKindleDevices.devices);
          setKindleLoadFailed(false);
        }
      } catch {
        if (!cancelled) {
          setKindleDevices([]);
          setKindleLoadFailed(true);
        }
      } finally {
        if (!cancelled) {
          setIsKindleLoading(false);
        }
      }
    }

    void loadKindleDevices();

    return () => {
      cancelled = true;
    };
  }, []);

  const schedule = useMemo(
    () =>
      buildScheduleBlocks(
        plan?.tasks ?? [],
        taskTypes,
        plan?.dayStartLocalTime.slice(0, 5) ?? "10:00",
        seasonMode,
        plan?.nightPlanEnabled ?? true,
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

  const summaryLine = useMemo(
    () => `今日共 ${plan?.tasks.length ?? 0} 个任务 · 专注 ${formatMinutes(schedule.focusMinutes)}`,
    [plan?.tasks.length, schedule.focusMinutes],
  );

  const kindleStatus = useMemo(() => {
    if (isKindleLoading) {
      return {
        online: false,
        lastPushedAt: "检查中",
        currentTitle: "正在连接 Kindle",
      };
    }

    if (kindleLoadFailed) {
      return {
        online: false,
        lastPushedAt: "稍后自动重试",
        currentTitle: "Kindle 状态暂时不可用",
      };
    }

    if (kindleDevices.length === 0) {
      return null;
    }

    const latestPushedDevice = [...kindleDevices]
      .filter((device) => device.lastPushedAt)
      .sort((left, right) => new Date(right.lastPushedAt ?? 0).getTime() - new Date(left.lastPushedAt ?? 0).getTime())
      .at(0);

    return {
      online: hasOnlineKindle(kindleDevices),
      lastPushedAt: formatKindleTime(latestPushedDevice?.lastPushedAt ?? null),
      currentTitle: latestPushedDevice?.currentScreenTitle ?? kindleDevices[0]?.currentScreenTitle ?? "暂无画面",
    };
  }, [isKindleLoading, kindleDevices, kindleLoadFailed]);

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
              {planDate} · {seasonMode === "SUMMER" ? "夏令时" : "冬令时"}
            </p>
          </div>

          <p className="today-summary-line">{summaryLine}</p>

          {kindleStatus ? (
            <div className="today-kindle-status">
              <span className={kindleStatus.online ? "kindle-status-dot online" : "kindle-status-dot"} />
              <div>
                <strong>{kindleStatus.online ? "Kindle 已连接" : "Kindle 未连接"}</strong>
                <p>最后推送 {kindleStatus.lastPushedAt} · 当前显示：{kindleStatus.currentTitle}</p>
              </div>
            </div>
          ) : null}

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
                <strong className="next-task-title">{spotlight.block.title}</strong>
                <p className="next-task-time">
                  {spotlight.block.localStartTime} - {spotlight.block.localEndTime}
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
                <h2>完整安排</h2>
                <p>先看重点，再向下核对今天的完整节奏。</p>
              </div>
            </div>

            <div className="table-shell">
              <table className="schedule-table today-plan-table today-local-table">
                <thead>
                  <tr>
                    <th>开始</th>
                    <th>结束</th>
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
