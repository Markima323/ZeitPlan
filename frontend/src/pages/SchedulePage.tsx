import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toBlob } from "html-to-image";
import { apiClient } from "../api/client";
import type {
  DailyPlanResponse,
  PlanTaskResponse,
  SeasonMode,
  TaskTypeResponse,
} from "../api/types";
import { buildScheduleBlocks, formatMinutes, todayIsoDate } from "../lib/schedule";
import { TaskIcon } from "../lib/taskIcons";

interface EditableTask extends PlanTaskResponse {
  clientId: string;
}

interface ResolvedPlanState {
  plan: DailyPlanResponse;
  taskTypes: TaskTypeResponse[];
  templateSourceDate: string | null;
  resetTaskIds: boolean;
}

type AutoSaveState = "idle" | "saving" | "saved" | "error";

function makeClientId() {
  return crypto.randomUUID();
}

function toEditableTasks(tasks: PlanTaskResponse[], resetTaskIds = false): EditableTask[] {
  return [...tasks]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((task) => ({
      ...task,
      id: resetTaskIds ? null : task.id,
      clientId: makeClientId(),
    }));
}

async function resolvePlanForDate(date: string): Promise<ResolvedPlanState> {
  const [plan, nextTaskTypes] = await Promise.all([apiClient.getPlan(date), apiClient.getTaskTypes()]);

  if (plan.tasks.length > 0) {
    return {
      plan,
      taskTypes: nextTaskTypes,
      templateSourceDate: null,
      resetTaskIds: false,
    };
  }

  const latestPlan = await apiClient.getLatestPlanBefore(date);
  if (latestPlan && latestPlan.tasks.length > 0) {
    return {
      plan: {
        ...plan,
        tasks: latestPlan.tasks,
      },
      taskTypes: nextTaskTypes,
      templateSourceDate: latestPlan.planDate,
      resetTaskIds: true,
    };
  }

  return {
    plan,
    taskTypes: nextTaskTypes,
    templateSourceDate: null,
    resetTaskIds: false,
  };
}

export function SchedulePage({
  seasonMode,
  onSeasonSync,
}: {
  seasonMode: SeasonMode;
  onSeasonSync: (value: SeasonMode) => void;
}) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const lastAppliedSeasonRef = useRef<SeasonMode>(seasonMode);
  const saveVersionRef = useRef(0);

  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [dayStartLocalTime, setDayStartLocalTime] = useState("10:00");
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeResponse[]>([]);
  const [templateSourceDate, setTemplateSourceDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");

  function markDirty() {
    setIsDirty(true);
    setAutoSaveState("idle");
  }

  function handleDateChange(nextDate: string) {
    saveVersionRef.current += 1;
    setSelectedDate(nextDate);
    setDayStartLocalTime("10:00");
    setTasks([]);
    setTemplateSourceDate(null);
    setFeedback(null);
    setIsDirty(false);
    setIsLoading(true);
    setAutoSaveState("idle");
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapPlan() {
      try {
        const resolvedPlan = await resolvePlanForDate(selectedDate);
        if (!cancelled) {
          lastAppliedSeasonRef.current = resolvedPlan.plan.seasonMode;
          setTaskTypes(resolvedPlan.taskTypes);
          setDayStartLocalTime(resolvedPlan.plan.dayStartLocalTime.slice(0, 5));
          setTasks(toEditableTasks(resolvedPlan.plan.tasks, resolvedPlan.resetTaskIds));
          setTemplateSourceDate(resolvedPlan.templateSourceDate);
          setIsDirty(false);
          setAutoSaveState("idle");
          setFeedback(null);
          onSeasonSync(resolvedPlan.plan.seasonMode);
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback(error instanceof Error ? error.message : "读取日程失败");
          setIsLoading(false);
        }
      }
    }

    void bootstrapPlan();

    return () => {
      cancelled = true;
    };
  }, [onSeasonSync, selectedDate]);

  useEffect(() => {
    if (isLoading || seasonMode === lastAppliedSeasonRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsDirty(true);
      setAutoSaveState("idle");
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, seasonMode]);

  useEffect(() => {
    if (isLoading || !isDirty) {
      return;
    }

    const currentVersion = ++saveVersionRef.current;

    const timeoutId = window.setTimeout(async () => {
      setAutoSaveState("saving");
      setFeedback(null);

      try {
        const savedPlan = await apiClient.savePlan(selectedDate, {
          planDate: selectedDate,
          seasonMode,
          dayStartLocalTime,
          tasks: tasks.map((task, index) => ({
            id: task.id,
            title: task.title.trim(),
            taskTypeId: task.taskTypeId,
            durationMinutes: task.durationMinutes,
            orderIndex: index,
          })),
        });

        if (saveVersionRef.current !== currentVersion) {
          return;
        }

        setDayStartLocalTime(savedPlan.dayStartLocalTime.slice(0, 5));
        setTasks(toEditableTasks(savedPlan.tasks));
        setTemplateSourceDate(null);
        setIsDirty(false);
        setAutoSaveState("saved");
        setFeedback(null);
        lastAppliedSeasonRef.current = savedPlan.seasonMode;
        onSeasonSync(savedPlan.seasonMode);
      } catch (error) {
        if (saveVersionRef.current !== currentVersion) {
          return;
        }

        setAutoSaveState("error");
        setFeedback(error instanceof Error ? error.message : "自动保存失败");
      }
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dayStartLocalTime, isDirty, onSeasonSync, seasonMode, selectedDate, tasks, isLoading]);

  const schedule = useMemo(
    () => buildScheduleBlocks(tasks, taskTypes, dayStartLocalTime, seasonMode),
    [dayStartLocalTime, seasonMode, taskTypes, tasks],
  );

  function addTask(afterIndex: number) {
    const defaultTypeId = taskTypes[0]?.id ?? null;
    const nextTask: EditableTask = {
      clientId: makeClientId(),
      id: null,
      title: "",
      taskTypeId: defaultTypeId,
      durationMinutes: 30,
      orderIndex: afterIndex + 1,
    };

    setTasks((current) => {
      const copy = [...current];
      copy.splice(afterIndex + 1, 0, nextTask);
      return copy.map((task, index) => ({
        ...task,
        orderIndex: index,
      }));
    });
    markDirty();
  }

  function removeTask(clientId: string) {
    setTasks((current) =>
      current
        .filter((task) => task.clientId !== clientId)
        .map((task, index) => ({
          ...task,
          orderIndex: index,
        })),
    );
    markDirty();
  }

  function updateTask(clientId: string, changes: Partial<EditableTask>) {
    setTasks((current) =>
      current.map((task) => (task.clientId === clientId ? { ...task, ...changes } : task)),
    );
    markDirty();
  }

  async function copyPreviewImage() {
    if (!previewRef.current) {
      return;
    }

    if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
      setFeedback("当前浏览器不支持直接写入图片到剪贴板");
      return;
    }

    setIsCopying(true);
    setFeedback(null);

    try {
      const blob = await toBlob(previewRef.current, {
        backgroundColor: "#fffaf2",
        pixelRatio: 2,
      });

      if (!blob) {
        throw new Error("生成图片失败");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);

      setFeedback("日程图片已复制到剪贴板");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "复制失败");
    } finally {
      setIsCopying(false);
    }
  }

  const autoSaveText =
    autoSaveState === "saving"
      ? "自动保存中..."
      : autoSaveState === "saved"
        ? "已自动保存"
        : autoSaveState === "error"
          ? "自动保存失败"
          : "修改后将自动保存";

  return (
    <div className="page-stack">
      {feedback ? <div className="feedback-banner">{feedback}</div> : null}

      <section className="planner-layout">
        <article className="editor-panel">
          <div className="panel-header">
            <div>
              <h2>任务编辑器</h2>
              <p>默认从今天开始。如果今天还没有计划，会自动载入上一份计划作为修改模板。</p>
            </div>
            <span className="autosave-indicator">{autoSaveText}</span>
          </div>

          <div className="planner-settings">
            <label className="field compact-field">
              <span>计划日期</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  handleDateChange(event.target.value);
                }}
              />
            </label>
            <label className="field compact-field">
              <span>首个任务开始</span>
              <input
                type="time"
                step={1800}
                value={dayStartLocalTime}
                onChange={(event) => {
                  setDayStartLocalTime(event.target.value);
                  markDirty();
                }}
              />
            </label>
          </div>

          {templateSourceDate ? (
            <div className="info-banner">
              当前日期还没有保存过计划，已载入 <strong>{templateSourceDate}</strong> 的最近计划作为模板。
            </div>
          ) : null}

          <div className="editor-scroll">
            <button className="insert-handle" type="button" onClick={() => addTask(-1)}>
              <span className="insert-line" />
              <span className="insert-plus">
                <Plus size={18} />
              </span>
            </button>

            {isLoading ? <div className="empty-state">正在加载这一天的计划...</div> : null}

            {!isLoading && tasks.length === 0 ? (
              <div className="empty-state">
                <p>这一天还没有任务块。</p>
                <button className="primary-button" type="button" onClick={() => addTask(-1)}>
                  <Plus size={16} />
                  添加第一个任务
                </button>
              </div>
            ) : null}

            {!isLoading
              ? tasks.map((task, index) => (
                  <div key={task.clientId}>
                    <div className="task-card">
                      <button
                        className="trash-button"
                        type="button"
                        aria-label="删除任务"
                        onClick={() => removeTask(task.clientId)}
                      >
                        <Trash2 size={16} />
                      </button>

                      <div className="task-card-grid">
                        <label className="field field-span-2">
                          <span>任务内容</span>
                          <input
                            type="text"
                            value={task.title}
                            placeholder="例如：复盘昨日数据、写 PRD、录音练习"
                            onChange={(event) => updateTask(task.clientId, { title: event.target.value })}
                          />
                        </label>

                        <label className="field">
                          <span>任务类型</span>
                          <select
                            value={task.taskTypeId ?? ""}
                            onChange={(event) =>
                              updateTask(task.clientId, {
                                taskTypeId: event.target.value ? Number(event.target.value) : null,
                              })
                            }
                          >
                            {taskTypes.length === 0 ? <option value="">请先创建类型</option> : null}
                            {taskTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="field">
                          <span>时长</span>
                          <div className="duration-switch">
                            {[30, 60].map((minutes) => (
                              <button
                                key={minutes}
                                type="button"
                                className={task.durationMinutes === minutes ? "active" : ""}
                                onClick={() =>
                                  updateTask(task.clientId, {
                                    durationMinutes: minutes as 30 | 60,
                                  })
                                }
                              >
                                {minutes === 30 ? "半小时" : "1 小时"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button className="insert-handle" type="button" onClick={() => addTask(index)}>
                      <span className="insert-line" />
                      <span className="insert-plus">
                        <Plus size={18} />
                      </span>
                    </button>
                  </div>
                ))
              : null}
          </div>

          {taskTypes.length === 0 ? (
            <div className="soft-warning">
              还没有任务类型，先去 <Link to="/types">任务类型页</Link> 建几个常用分类吧。
            </div>
          ) : null}
        </article>

        <aside className="preview-panel">
          <div className="panel-header">
            <div>
              <h2>日程预览</h2>
              <p>复制按钮会把右侧这张卡片生成图片并写入剪贴板。</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void copyPreviewImage()}
              disabled={isCopying || isLoading}
            >
              <Copy size={16} />
              {isCopying ? "生成中..." : "复制图片"}
            </button>
          </div>

          <div className="summary-strip">
            <div className="summary-chip">
              <span>专注时长</span>
              <strong>{formatMinutes(schedule.focusMinutes)}</strong>
            </div>
            <div className="summary-chip">
              <span>休息总计</span>
              <strong>{formatMinutes(schedule.breakMinutes)}</strong>
            </div>
            <div className="summary-chip">
              <span>任务数量</span>
              <strong>{tasks.length}</strong>
            </div>
          </div>

          <div ref={previewRef} className="schedule-card">
            <div className="schedule-card-head">
              <div>
                <p className="eyebrow">ZeitPlan</p>
                <h3>{selectedDate} 日计划</h3>
              </div>
            </div>

            <div className="table-shell">
              <table className="schedule-table">
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        正在加载这一天的计划...
                      </td>
                    </tr>
                  ) : null}
                  {!isLoading
                    ? schedule.blocks.map((block) => (
                        <tr key={block.id} className={block.breakBlock ? "break-row" : ""}>
                          <td>{block.localStartTime}</td>
                          <td>{block.localEndTime}</td>
                          <td>{block.beijingStartTime}</td>
                          <td>{block.beijingEndTime}</td>
                          <td>
                            <span className="task-cell">
                              <span
                                className="task-icon-wrap"
                                style={{ backgroundColor: block.breakBlock ? "#FFF5E8" : `${block.typeColor}22` }}
                              >
                                <TaskIcon iconKey={block.typeIcon} className="task-icon" />
                              </span>
                              <span>
                                <strong>{block.title}</strong>
                                <small>{block.typeName}</small>
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))
                    : null}
                  {!isLoading && schedule.blocks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        还没有任务，左侧添加后这里会自动生成完整时间表。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
