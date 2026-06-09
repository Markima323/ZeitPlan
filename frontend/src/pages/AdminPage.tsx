import { useEffect, useState } from "react";
import { BarChart3, CalendarRange, Clock3 } from "lucide-react";
import { apiClient } from "../api/client";
import type { AdminOverviewResponse } from "../api/types";
import { formatMinutes, todayIsoDate } from "../lib/schedule";
import { TaskIcon } from "../lib/taskIcons";

function plusDays(start: Date, offset: number) {
  const next = new Date(start);
  next.setDate(next.getDate() + offset);
  return next;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AdminPage() {
  const [fromDate, setFromDate] = useState(toIsoDate(plusDays(new Date(), -6)));
  const [toDate, setToDate] = useState(todayIsoDate());
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadOverview() {
    try {
      setFeedback(null);
      const nextOverview = await apiClient.getAdminOverview(fromDate, toDate);
      setOverview(nextOverview);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "读取后台统计失败");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapOverview() {
      try {
        const nextOverview = await apiClient.getAdminOverview(fromDate, toDate);
        if (!cancelled) {
          setOverview(nextOverview);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback(error instanceof Error ? error.message : "读取后台统计失败");
        }
      }
    }

    void bootstrapOverview();

    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate]);

  return (
    <div className="page-stack">
      {feedback ? <div className="feedback-banner">{feedback}</div> : null}

      <section className="content-panel">
        <div className="panel-header">
          <div>
            <h2>筛选范围</h2>
            <p>查看每天的计划，以及一段时间内每种任务类型的总时长。</p>
          </div>
          <div className="panel-actions">
            <label className="field compact-field">
              <span>开始日期</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="field compact-field">
              <span>结束日期</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <button className="primary-button" type="button" onClick={() => void loadOverview()}>
              更新统计
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <BarChart3 size={20} />
            <div className="stat-copy">
              <span>已规划天数</span>
              <strong>{overview?.plannedDays ?? 0}</strong>
            </div>
          </article>
          <article className="stat-card">
            <Clock3 size={20} />
            <div className="stat-copy">
              <span>专注总时长</span>
              <strong>{formatMinutes(overview?.focusMinutes ?? 0)}</strong>
            </div>
          </article>
          <article className="stat-card">
            <CalendarRange size={20} />
            <div className="stat-copy">
              <span>休息总时长</span>
              <strong>{formatMinutes(overview?.breakMinutes ?? 0)}</strong>
            </div>
          </article>
        </div>
      </section>

      <section className="two-column-grid">
        <article className="content-panel">
          <div className="panel-header">
            <div>
              <h2>每日计划</h2>
              <p>按天查看任务数量、首尾时间和当日重点。</p>
            </div>
          </div>

          <div className="admin-day-list">
            {overview?.days.map((day) => (
              <article key={day.planDate} className="admin-day-card">
                <div className="admin-day-top">
                  <div>
                    <strong>{day.planDate}</strong>
                    <p>{day.seasonMode === "SUMMER" ? "夏令时 +6" : "冬令时 +7"}</p>
                  </div>
                  <span className="badge-soft">{day.taskCount} 个任务</span>
                </div>

                <div className="admin-day-meta">
                  <span>专注 {formatMinutes(day.focusMinutes)}</span>
                  <span>休息 {formatMinutes(day.breakMinutes)}</span>
                  <span>
                    {day.firstLocalStartTime ?? "--:--"} - {day.lastLocalEndTime ?? "--:--"}
                  </span>
                </div>

                <div className="highlight-list">
                  {day.highlightTasks.map((highlight) => (
                    <span key={`${day.planDate}-${highlight}`} className="badge-soft">
                      {highlight}
                    </span>
                  ))}
                </div>
              </article>
            ))}

            {overview?.days.length === 0 ? <div className="empty-state">这个时间段还没有计划数据。</div> : null}
          </div>
        </article>

        <aside className="content-panel">
          <div className="panel-header">
            <div>
              <h2>类型时长统计</h2>
              <p>聚合所有任务类型，看看精力主要花在哪里。</p>
            </div>
          </div>

          <div className="type-stats-list">
            {overview?.typeStats.map((stat) => (
              <article key={`${stat.taskTypeId}-${stat.taskTypeName}`} className="type-stat-row">
                <div className="type-row-main">
                  <span className="task-icon-wrap" style={{ backgroundColor: `${stat.taskTypeColor}22` }}>
                    <TaskIcon iconKey={stat.taskTypeIcon} className="task-icon" />
                  </span>
                  <div>
                    <strong>{stat.taskTypeName}</strong>
                    <p>{formatMinutes(stat.totalMinutes)}</p>
                  </div>
                </div>
                <strong>{Math.round(stat.totalMinutes / 30) / 2} h</strong>
              </article>
            ))}

            {overview?.typeStats.length === 0 ? <div className="empty-state">这里还没有可统计的任务类型。</div> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
