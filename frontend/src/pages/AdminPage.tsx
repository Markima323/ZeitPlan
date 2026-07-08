import { useEffect, useState, type FormEvent } from "react";
import { BarChart3, BatteryMedium, Clock3, Plus, Radio, RefreshCw } from "lucide-react";
import { apiClient } from "../api/client";
import type { AdminOverviewResponse, KindleDevice } from "../api/types";
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "暂无记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isRecentlySeen(device: KindleDevice) {
  if (!device.lastSeenAt) {
    return false;
  }

  return Date.now() - new Date(device.lastSeenAt).getTime() < 2 * 60 * 1000;
}

export function AdminPage() {
  const [fromDate, setFromDate] = useState(toIsoDate(plusDays(new Date(), -6)));
  const [toDate, setToDate] = useState(todayIsoDate());
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [kindleDevices, setKindleDevices] = useState<KindleDevice[]>([]);
  const [kindleDeviceName, setKindleDeviceName] = useState("Paperwhite");
  const [newKindleToken, setNewKindleToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [kindleFeedback, setKindleFeedback] = useState<string | null>(null);
  const [isKindleLoading, setIsKindleLoading] = useState(true);
  const [isCreatingKindleDevice, setIsCreatingKindleDevice] = useState(false);
  const [repushingDeviceId, setRepushingDeviceId] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    async function bootstrapKindleDevices() {
      setIsKindleLoading(true);
      try {
        const nextKindleDevices = await apiClient.getKindleDevices();
        if (!cancelled) {
          setKindleDevices(nextKindleDevices.devices);
          setKindleFeedback(null);
        }
      } catch (error) {
        if (!cancelled) {
          setKindleFeedback(error instanceof Error ? error.message : "读取 Kindle 设备失败");
        }
      } finally {
        if (!cancelled) {
          setIsKindleLoading(false);
        }
      }
    }

    void bootstrapKindleDevices();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshKindleDevices(options: { showFeedbackOnError?: boolean } = {}) {
    setIsKindleLoading(true);
    try {
      const nextKindleDevices = await apiClient.getKindleDevices();
      setKindleDevices(nextKindleDevices.devices);
    } catch (error) {
      if (options.showFeedbackOnError !== false) {
        setKindleFeedback(error instanceof Error ? error.message : "刷新 Kindle 设备失败");
      }
    } finally {
      setIsKindleLoading(false);
    }
  }

  async function handleCreateKindleDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kindleDeviceName.trim() === "") {
      return;
    }

    setIsCreatingKindleDevice(true);
    setKindleFeedback(null);
    try {
      const response = await apiClient.createKindleDevice(kindleDeviceName.trim());
      setNewKindleToken(response.deviceToken);
      setKindleDevices((devices) => [...devices.filter((device) => device.id !== response.device.id), response.device]);
      await refreshKindleDevices({ showFeedbackOnError: false });
      setKindleFeedback("Kindle 设备已创建。请立即保存下方 Token，它只显示这一次。");
    } catch (error) {
      setKindleFeedback(error instanceof Error ? error.message : "创建 Kindle 设备失败");
    } finally {
      setIsCreatingKindleDevice(false);
    }
  }

  async function handleRepush(deviceId: string) {
    setRepushingDeviceId(deviceId);
    setKindleFeedback(null);
    try {
      const response = await apiClient.repushKindleTodayPlan(deviceId);
      setKindleDevices((devices) =>
        devices.map((device) =>
          device.id === deviceId
            ? { ...device, currentVersion: response.version, lastPushedAt: new Date().toISOString() }
            : device,
        ),
      );
      await refreshKindleDevices({ showFeedbackOnError: false });
      setKindleFeedback("已重新生成 Kindle 画面。");
    } catch (error) {
      setKindleFeedback(error instanceof Error ? error.message : "重新推送失败");
    } finally {
      setRepushingDeviceId(null);
    }
  }

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

      <section className="content-panel secondary-panel kindle-admin-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Kindle</p>
            <h2>Kindle 状态屏</h2>
            <p>用于把“今日计划”的当前进行中事项推送到 Kindle。设备通过 Token 长轮询连接，不会拿到网页登录态。</p>
          </div>

          <form className="kindle-create-form" onSubmit={(event) => void handleCreateKindleDevice(event)}>
            <label className="field compact-field">
              <span>设备名称</span>
              <input
                value={kindleDeviceName}
                onChange={(event) => setKindleDeviceName(event.target.value)}
                placeholder="例如：Paperwhite"
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={isCreatingKindleDevice || kindleDeviceName.trim() === ""}
            >
              <Plus size={16} />
              {isCreatingKindleDevice ? "创建中..." : "创建设备"}
            </button>
          </form>
        </div>

        {kindleFeedback ? <div className="feedback-banner">{kindleFeedback}</div> : null}

        {newKindleToken ? (
          <div className="kindle-token-box">
            <strong>一次性设备 Token</strong>
            <code>{newKindleToken}</code>
            <p>把它写入 Kindle 脚本的 <code>API_KEY</code>。关闭或刷新页面后不会再次显示。</p>
          </div>
        ) : null}

        <div className="kindle-device-list">
          {kindleDevices.map((device) => (
            <article key={device.id} className="kindle-device-card">
              <div className="kindle-device-main">
                <span className={isRecentlySeen(device) ? "kindle-status-dot online" : "kindle-status-dot"} />
                <div>
                  <strong>{device.name}</strong>
                  <p>{isRecentlySeen(device) ? "长轮询在线" : "未连接或已离线"}</p>
                </div>
              </div>

              <div className="kindle-device-meta">
                <span>
                  <Radio size={16} />
                  最后在线 {formatDateTime(device.lastSeenAt)}
                </span>
                <span>
                  <Clock3 size={16} />
                  最后推送 {formatDateTime(device.lastPushedAt)}
                </span>
                <span>
                  <BatteryMedium size={16} />
                  电量 {device.lastBatteryPercentage == null ? "--" : `${device.lastBatteryPercentage}%`}
                </span>
              </div>

              <div className="kindle-current-screen">
                <span>当前显示</span>
                <strong>{device.currentScreenTitle ?? "暂无画面"}</strong>
                {device.lastErrorMessage ? <p>{device.lastErrorMessage}</p> : null}
              </div>

              <button
                className="secondary-button"
                type="button"
                onClick={() => void handleRepush(device.id)}
                disabled={repushingDeviceId === device.id || !device.enabled}
              >
                <RefreshCw size={16} />
                {repushingDeviceId === device.id ? "重推中..." : "重新推送今日计划"}
              </button>
            </article>
          ))}

          {isKindleLoading ? (
            <div className="empty-state">正在检查 Kindle 设备连接...</div>
          ) : null}

          {!isKindleLoading && kindleDevices.length === 0 ? (
            <div className="empty-state">还没有 Kindle 设备。先创建设备，再把 Token 配进 KUAL 长轮询脚本。</div>
          ) : null}
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
