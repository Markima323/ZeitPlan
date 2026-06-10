import { useEffect, useState } from "react";
import { BarChart3, Clock3 } from "lucide-react";
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

  useEffect(() => {
    let cancelled = false;

    async function bootstrapOverview() {
      try {
        const nextOverview = await apiClient.getAdminOverview(fromDate, toDate);
        if (!cancelled) {
          setOverview(nextOverview);
          setFeedback(null);
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

      <section className="content-panel secondary-panel admin-toolbar">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>后台统计</h2>
            <p>顶部只保留时间范围和两个核心结果，把阅读重心留给下面的每日计划与类型时长。</p>
          </div>
          <div className="panel-actions admin-filter-row">
            <label className="field compact-field">
              <span>开始日期</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="field compact-field">
              <span>结束日期</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="admin-summary-line">
          <span className="admin-summary-pill">
            <BarChart3 size={18} />
            <strong>{overview?.plannedDays ?? 0}</strong>
            已规划天数
          </span>
          <span className="admin-summary-pill">
            <Clock3 size={18} />
            <strong>{formatMinutes(overview?.focusMinutes ?? 0)}</strong>
            专注总时长
          </span>
        </div>
      </section>

      <section className="two-column-grid admin-layout">
        <article className="content-panel focus-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Daily</p>
              <h2>每日计划</h2>
              <p>这里作为主阅读区，集中查看每天的节奏、任务数量和重点任务。</p>
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

        <aside className="content-panel secondary-panel admin-side-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Type Stats</p>
              <h2>类型时长统计</h2>
              <p>这里只统计被标记为专注任务的类型，避免把吃饭、恢复一类任务混进专注总量。</p>
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

            {overview?.typeStats.length === 0 ? <div className="empty-state">这里还没有可统计的专注任务类型。</div> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
