import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, PencilLine, Plus, Trash2 } from "lucide-react";
import { getFontEmbedCSS, toBlob } from "html-to-image";
import { apiClient } from "../api/client";
import type {
  DailyPlanResponse,
  PlanTaskResponse,
  SeasonMode,
  TaskTypeResponse,
} from "../api/types";
import {
  buildScheduleBlocks,
  buildTaskTimeline,
  formatMinutes,
  getAutomaticBreakMinutes,
  MIN_SLOT_DURATION_MINUTES,
  normalizeSlotDuration,
  parseClock,
  resolveClockAtOrAfter,
  todayIsoDate,
  toClock,
} from "../lib/schedule";
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
type PreviewTarget = "day" | "evening";

const DAY_PREVIEW_START_MINUTES = 6 * 60;
const DAY_PREVIEW_END_MINUTES = 17 * 60;
const EVENING_PREVIEW_START_MINUTES = 17 * 60;
const EVENING_PREVIEW_END_MINUTES = 3 * 60;

function makeClientId() {
  return crypto.randomUUID();
}

function isWithinPreviewRange(minutes: number, rangeStartMinutes: number, rangeEndMinutes: number) {
  if (rangeStartMinutes < rangeEndMinutes) {
    return minutes >= rangeStartMinutes && minutes < rangeEndMinutes;
  }

  return minutes >= rangeStartMinutes || minutes < rangeEndMinutes;
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

function getDefaultTaskTypeId(taskTypes: TaskTypeResponse[]) {
  return taskTypes.find((type) => type.name === "深度工作")?.id ?? taskTypes[0]?.id ?? null;
}

function getPreferredDefaultTaskTypeId(taskTypes: TaskTypeResponse[]) {
  return (
    taskTypes.find((type) => type.iconKey === "code")?.id ??
    taskTypes.find((type) => type.focusTask)?.id ??
    getDefaultTaskTypeId(taskTypes)
  );
}

function mergeSavedTaskIds(currentTasks: EditableTask[], savedTasks: PlanTaskResponse[]) {
  const savedTaskIdsByOrder = new Map(
    [...savedTasks]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((task) => [task.orderIndex, task.id]),
  );

  let changed = false;
  const nextTasks = currentTasks.map((task) => {
    const savedId = savedTaskIdsByOrder.get(task.orderIndex);
    if (savedId == null || savedId === task.id) {
      return task;
    }

    changed = true;
    return {
      ...task,
      id: savedId,
    };
  });

  return changed ? nextTasks : currentTasks;
}

function createExportPreviewNode(sourceNode: HTMLDivElement) {
  const wrapper = document.createElement("div");
  const clone = sourceNode.cloneNode(true) as HTMLDivElement;
  const sourceTable = sourceNode.querySelector("table");
  const exportWidth = Math.max(
    Math.ceil(sourceNode.getBoundingClientRect().width),
    sourceTable instanceof HTMLElement ? Math.ceil(sourceTable.scrollWidth) + 32 : 0,
  );

  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.zIndex = "-1";
  wrapper.style.width = `${exportWidth}px`;
  wrapper.style.background = "#fffaf2";
  wrapper.style.pointerEvents = "none";

  clone.style.width = `${exportWidth}px`;
  clone.style.maxWidth = "none";
  clone.style.overflow = "visible";

  clone.querySelectorAll<HTMLElement>(".table-shell").forEach((shell) => {
    shell.style.overflow = "visible";
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return {
    wrapper,
    node: clone,
    width: Math.max(exportWidth, Math.ceil(clone.scrollWidth)),
    height: Math.ceil(clone.scrollHeight),
  };
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
        nightPlanEnabled: latestPlan.nightPlanEnabled,
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
  const dayPreviewRef = useRef<HTMLDivElement | null>(null);
  const eveningPreviewRef = useRef<HTMLDivElement | null>(null);
  const taskCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastAppliedSeasonRef = useRef<SeasonMode>(seasonMode);
  const saveVersionRef = useRef(0);
  const previewFontEmbedCssRef = useRef<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [dayStartLocalTime, setDayStartLocalTime] = useState("10:00");
  const [nightPlanEnabled, setNightPlanEnabled] = useState(true);
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeResponse[]>([]);
  const [templateSourceDate, setTemplateSourceDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copyingTarget, setCopyingTarget] = useState<PreviewTarget | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  function markDirty() {
    saveVersionRef.current += 1;
    setIsDirty(true);
    setAutoSaveState("idle");
  }

  function handleDateChange(nextDate: string) {
    saveVersionRef.current += 1;
    setSelectedDate(nextDate);
    setDayStartLocalTime("10:00");
    setNightPlanEnabled(true);
    setTasks([]);
    setTemplateSourceDate(null);
    setFeedback(null);
    setIsDirty(false);
    setIsLoading(true);
    setAutoSaveState("idle");
    setExpandedTaskId(null);
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
          setNightPlanEnabled(resolvedPlan.plan.nightPlanEnabled);
          setTasks(toEditableTasks(resolvedPlan.plan.tasks, resolvedPlan.resetTaskIds));
          setTemplateSourceDate(resolvedPlan.templateSourceDate);
          setIsDirty(false);
          setAutoSaveState("idle");
          setFeedback(null);
          setExpandedTaskId(null);
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
      markDirty();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, seasonMode]);

  useEffect(() => {
    let cancelled = false;

    async function warmPreviewFontCache() {
      if (previewFontEmbedCssRef.current) {
        return;
      }

      const previewNode = dayPreviewRef.current ?? eveningPreviewRef.current;
      if (!previewNode) {
        return;
      }

      try {
        const nextFontEmbedCss = await getFontEmbedCSS(previewNode, {
          preferredFontFormat: "woff2",
        });
        if (!cancelled) {
          previewFontEmbedCssRef.current = nextFontEmbedCss;
        }
      } catch {
        // Ignore warm-up failures and use the default export path instead.
      }
    }

    const timeoutId = window.setTimeout(() => {
      void warmPreviewFontCache();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, selectedDate, tasks.length]);

  useEffect(() => {
    if (isLoading || !isDirty) {
      return;
    }

    const currentVersion = saveVersionRef.current;

    const timeoutId = window.setTimeout(async () => {
      setAutoSaveState("saving");
      setFeedback(null);

      try {
        const savedPlan = await apiClient.savePlan(selectedDate, {
          planDate: selectedDate,
          seasonMode,
          dayStartLocalTime,
          nightPlanEnabled,
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

        const nextDayStartLocalTime = savedPlan.dayStartLocalTime.slice(0, 5);
        if (nextDayStartLocalTime !== dayStartLocalTime) {
          setDayStartLocalTime(nextDayStartLocalTime);
        }

        setTasks((current) => mergeSavedTaskIds(current, savedPlan.tasks));
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
  }, [dayStartLocalTime, isDirty, nightPlanEnabled, onSeasonSync, seasonMode, selectedDate, tasks, isLoading]);

  const orderedTasks = useMemo(
    () => [...tasks].sort((left, right) => left.orderIndex - right.orderIndex),
    [tasks],
  );

  const taskClientIdByOrderIndex = useMemo(
    () => new Map(orderedTasks.map((task) => [task.orderIndex, task.clientId])),
    [orderedTasks],
  );

  const taskTimeline = useMemo(() => buildTaskTimeline(orderedTasks, dayStartLocalTime), [dayStartLocalTime, orderedTasks]);

  const schedule = useMemo(
    () => buildScheduleBlocks(orderedTasks, taskTypes, dayStartLocalTime, seasonMode, nightPlanEnabled),
    [dayStartLocalTime, nightPlanEnabled, orderedTasks, seasonMode, taskTypes],
  );

  const daytimePreviewBlocks = useMemo(
    () =>
      schedule.blocks.filter((block) =>
        isWithinPreviewRange(parseClock(block.localStartTime), DAY_PREVIEW_START_MINUTES, DAY_PREVIEW_END_MINUTES),
      ),
    [schedule.blocks],
  );

  const eveningPreviewBlocks = useMemo(
    () => nightPlanEnabled
      ? (
      schedule.blocks.filter((block) =>
        isWithinPreviewRange(
          parseClock(block.localStartTime),
          EVENING_PREVIEW_START_MINUTES,
          EVENING_PREVIEW_END_MINUTES,
        ),
      ))
      : [],
    [nightPlanEnabled, schedule.blocks],
  );

  function updateTaskByIndex(index: number, changes: Partial<EditableTask>) {
    const task = orderedTasks[index];
    if (!task) {
      return;
    }

    updateTask(task.clientId, changes);
  }

  function updateTaskSlotDuration(index: number, minutes: number) {
    updateTaskByIndex(index, {
      durationMinutes: normalizeSlotDuration(minutes),
    });
  }

  function updateTaskStartTime(index: number, nextTime: string) {
    if (index === 0) {
      setDayStartLocalTime(nextTime);
      markDirty();
      return;
    }

    const previousTimelineEntry = taskTimeline[index - 1];
    if (!previousTimelineEntry) {
      return;
    }

    const targetStartMinutes = resolveClockAtOrAfter(previousTimelineEntry.slotStartMinutes, nextTime);
    const breakMinutesBeforeCurrent = getAutomaticBreakMinutes(index, targetStartMinutes);
    updateTaskSlotDuration(
      index - 1,
      targetStartMinutes - breakMinutesBeforeCurrent - previousTimelineEntry.slotStartMinutes,
    );
  }

  function updateTaskEndTime(index: number, nextTime: string) {
    const timelineEntry = taskTimeline[index];
    if (!timelineEntry) {
      return;
    }

    const targetEndMinutes = resolveClockAtOrAfter(timelineEntry.slotStartMinutes, nextTime);
    updateTaskSlotDuration(index, targetEndMinutes - timelineEntry.slotStartMinutes);
  }

  function addTask(afterIndex: number) {
    const defaultTypeId = getPreferredDefaultTaskTypeId(taskTypes);
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

  function scrollToTaskEditor(taskOrderIndex: number | null) {
    if (taskOrderIndex === null) {
      return;
    }

    const clientId = taskClientIdByOrderIndex.get(taskOrderIndex);
    if (!clientId) {
      return;
    }

    setExpandedTaskId(clientId);

    window.setTimeout(() => {
      const card = taskCardRefs.current[clientId];
      if (!card) {
        return;
      }

      card.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      const titleInput = card.querySelector('input[type="text"]');
      if (titleInput instanceof HTMLInputElement) {
        titleInput.focus();
        titleInput.select();
      }
    }, 120);
  }

  async function copyPreviewImage(target: PreviewTarget) {
    const previewNode = target === "day" ? dayPreviewRef.current : eveningPreviewRef.current;
    const previewLabel = target === "day" ? "白天日程图" : "夜间日程图";

    if (target === "evening" && !nightPlanEnabled) {
      setFeedback("夜计划未启用，当前无法导出夜间预览");
      return;
    }

    if (!previewNode) {
      return;
    }

    if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
      setFeedback("当前浏览器不支持直接写入图片到剪贴板");
      return;
    }

    setCopyingTarget(target);
    setFeedback(null);

    let exportSnapshot: ReturnType<typeof createExportPreviewNode> | null = null;

    try {
      const fontEmbedCSS =
        previewFontEmbedCssRef.current ??
        await getFontEmbedCSS(previewNode, {
          preferredFontFormat: "woff2",
        });
      previewFontEmbedCssRef.current = fontEmbedCSS;

      exportSnapshot = createExportPreviewNode(previewNode);

      const blob = await toBlob(exportSnapshot.node, {
        backgroundColor: "#fffaf2",
        pixelRatio: 1.5,
        width: exportSnapshot.width,
        height: exportSnapshot.height,
        canvasWidth: Math.round(exportSnapshot.width * 1.5),
        canvasHeight: Math.round(exportSnapshot.height * 1.5),
        preferredFontFormat: "woff2",
        fontEmbedCSS,
      });

      if (!blob) {
        throw new Error("生成图片失败");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);

      setFeedback(`${previewLabel}已复制到剪贴板`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "复制失败");
    } finally {
      exportSnapshot?.wrapper.remove();
      setCopyingTarget(null);
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

  const plannerSummaryLine = `${selectedDate} · ${tasks.length} 个任务 · 专注 ${formatMinutes(schedule.focusMinutes)}${nightPlanEnabled ? "" : " · 夜计划关闭"}`;

  return (
    <div className="page-stack">
      {feedback ? <div className="feedback-banner">{feedback}</div> : null}

      <section className="planner-layout planner-focus-layout">
        <article className="editor-panel focus-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Planner</p>
              <h2>任务编辑器</h2>
              <p>先确定当天的节奏，再逐项微调任务，右侧预览只保留辅助参考。</p>
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
                step={300}
                value={dayStartLocalTime}
                onChange={(event) => {
                  setDayStartLocalTime(event.target.value);
                  markDirty();
                }}
              />
            </label>
            <label className="field compact-field">
              <span>夜计划导出</span>
              <button
                className={nightPlanEnabled ? "toggle-chip active" : "toggle-chip"}
                type="button"
                onClick={() => {
                  setNightPlanEnabled((current) => !current);
                  markDirty();
                }}
                aria-pressed={nightPlanEnabled}
              >
                {nightPlanEnabled ? "已启用" : "未启用"}
              </button>
            </label>
          </div>

          <div className="planner-summary-line">
            <span>{plannerSummaryLine}</span>
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
              ? orderedTasks.map((task, index) => {
                  const timelineEntry = taskTimeline[index];
                  const isExpanded = expandedTaskId === task.clientId;

                  return (
                    <div
                      key={task.clientId}
                      ref={(node) => {
                        if (node) {
                          taskCardRefs.current[task.clientId] = node;
                        } else {
                          delete taskCardRefs.current[task.clientId];
                        }
                      }}
                    >
                      <div className="task-card">
                        <div className="task-card-toolbar">
                          <button
                            className={isExpanded ? "ghost-icon-button active" : "ghost-icon-button"}
                            type="button"
                            aria-label={isExpanded ? "收起高级编辑" : "打开高级编辑"}
                            onClick={() => setExpandedTaskId((current) => (current === task.clientId ? null : task.clientId))}
                          >
                            <PencilLine size={16} />
                          </button>
                        </div>

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
                            <span>时段时长</span>
                            <div className="duration-switch">
                              {[30, 60].map((minutes) => (
                                <button
                                  key={minutes}
                                  type="button"
                                  className={task.durationMinutes === minutes ? "active" : ""}
                                  onClick={() => updateTaskSlotDuration(index, minutes)}
                                >
                                  {minutes === 30 ? "半小时" : "1 小时"}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="field">
                            <span>当前时间</span>
                            <div className="task-time-chip">
                              {timelineEntry
                                ? `${toClock(timelineEntry.taskStartMinutes)} - ${toClock(timelineEntry.taskEndMinutes)}`
                                : "--:--"}
                            </div>
                          </div>
                        </div>

                        {timelineEntry ? (
                          <p className="task-detail-note">
                            {timelineEntry.hasBreakBefore
                              ? `本任务前固定保留 ${timelineEntry.breakMinutesBefore} 分钟休息，当前专注 ${formatMinutes(timelineEntry.focusMinutes)}，整个时段 ${formatMinutes(task.durationMinutes)}。修改开始时间时会联动前一个时段。`
                              : index > 0
                                ? `当前这个时间点不会额外插入自动休息，当前专注 ${formatMinutes(timelineEntry.focusMinutes)}。`
                                : `当前专注 ${formatMinutes(timelineEntry.focusMinutes)}。`}
                          </p>
                        ) : null}

                        {isExpanded && timelineEntry ? (
                          <div className="task-advanced-grid">
                            <label className="field">
                              <span>开始时间</span>
                              <input
                                type="time"
                                step={300}
                                value={toClock(timelineEntry.taskStartMinutes)}
                                min={
                                  index > 0
                                    ? toClock(
                                        taskTimeline[index - 1].slotStartMinutes +
                                          MIN_SLOT_DURATION_MINUTES +
                                          getAutomaticBreakMinutes(
                                            index,
                                            taskTimeline[index - 1].slotStartMinutes + MIN_SLOT_DURATION_MINUTES,
                                          ),
                                      )
                                    : undefined
                                }
                                onChange={(event) => updateTaskStartTime(index, event.target.value)}
                              />
                            </label>

                            <label className="field">
                              <span>结束时间</span>
                              <input
                                type="time"
                                step={300}
                                value={toClock(timelineEntry.taskEndMinutes)}
                                onChange={(event) => updateTaskEndTime(index, event.target.value)}
                              />
                            </label>

                            <label className="field">
                              <span>自定义时长（分钟）</span>
                              <input
                                type="number"
                                min={MIN_SLOT_DURATION_MINUTES}
                                max={1440}
                                step={5}
                                value={task.durationMinutes}
                                onChange={(event) => updateTaskSlotDuration(index, Number(event.target.value))}
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>

                      <button className="insert-handle" type="button" onClick={() => addTask(index)}>
                        <span className="insert-line" />
                        <span className="insert-plus">
                          <Plus size={18} />
                        </span>
                      </button>
                    </div>
                  );
                })
              : null}
          </div>

          {taskTypes.length === 0 ? (
            <div className="soft-warning">
              还没有任务类型，先去 <Link to="/types">任务类型页</Link> 建几个常用分类吧。
            </div>
          ) : null}
        </article>

        <aside className="preview-panel secondary-panel planner-preview-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>日程预览</h2>
            </div>
            <div className="panel-actions preview-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => void copyPreviewImage("day")}
                disabled={copyingTarget !== null || isLoading || daytimePreviewBlocks.length === 0}
              >
                <Copy size={16} />
                {copyingTarget === "day" ? "生成中..." : "复制白天图"}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => void copyPreviewImage("evening")}
                disabled={copyingTarget !== null || isLoading || !nightPlanEnabled || eveningPreviewBlocks.length === 0}
              >
                <Copy size={16} />
                {copyingTarget === "evening" ? "生成中..." : "复制夜间图"}
              </button>
            </div>
          </div>

          <div className="preview-summary-line">
            <span>{plannerSummaryLine}</span>
          </div>

          <div className="preview-stack">
            <div ref={dayPreviewRef} className="schedule-card planner-preview-card">
              <div className="schedule-card-head">
                <div>
                  <p className="eyebrow">ZeitPlan</p>
                  <h3>{selectedDate} 日计划</h3>
                  <p className="preview-card-caption">德国 06:00-17:00 · 本地时间 / 北京时间对照</p>
                </div>
              </div>

              <div className="table-shell">
                <table className="schedule-table day-preview-table">
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
                      ? daytimePreviewBlocks.map((block) => (
                          <tr
                            key={block.id}
                            className={[
                              block.breakBlock ? "break-row" : "",
                              block.editable ? "preview-task-row" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            title={block.editable ? "双击跳转到左侧任务编辑器" : undefined}
                            onDoubleClick={() => scrollToTaskEditor(block.taskOrderIndex)}
                          >
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
                                <span className="task-copy">
                                  <strong>{block.title}</strong>
                                  <small>{block.typeName}</small>
                                </span>
                              </span>
                            </td>
                          </tr>
                        ))
                      : null}
                    {!isLoading && daytimePreviewBlocks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="table-empty">
                          06:00 到 17:00 之间还没有可导出的任务。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {nightPlanEnabled ? (
              <div ref={eveningPreviewRef} className="schedule-card planner-preview-card night-preview-card">
                <div className="schedule-card-head">
                  <div>
                    <p className="eyebrow">ZeitPlan</p>
                    <h3>{selectedDate} 夜间计划</h3>
                    <p className="preview-card-caption">德国 17:00-03:00 · 仅显示德国本地时间</p>
                  </div>
                </div>

                <div className="table-shell">
                  <table className="schedule-table night-preview-table">
                    <thead>
                      <tr>
                        <th>本地开始</th>
                        <th>本地结束</th>
                        <th>任务内容</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={3} className="table-empty">
                            正在加载这一天的计划...
                          </td>
                        </tr>
                      ) : null}
                      {!isLoading
                        ? eveningPreviewBlocks.map((block) => (
                            <tr
                              key={block.id}
                              className={[
                                block.breakBlock ? "break-row" : "",
                                block.editable ? "preview-task-row" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              title={block.editable ? "双击跳转到左侧任务编辑器" : undefined}
                              onDoubleClick={() => scrollToTaskEditor(block.taskOrderIndex)}
                            >
                              <td>{block.localStartTime}</td>
                              <td>{block.localEndTime}</td>
                              <td>
                                <span className="task-cell">
                                  <span
                                    className="task-icon-wrap"
                                    style={{ backgroundColor: block.breakBlock ? "#FFF5E8" : `${block.typeColor}22` }}
                                  >
                                    <TaskIcon iconKey={block.typeIcon} className="task-icon" />
                                  </span>
                                  <span className="task-copy">
                                    <strong>{block.title}</strong>
                                    <small>{block.typeName}</small>
                                  </span>
                                </span>
                              </td>
                            </tr>
                          ))
                        : null}
                      {!isLoading && eveningPreviewBlocks.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="table-empty">
                            17:00 到次日 03:00 之间还没有可导出的任务。
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="schedule-card planner-preview-card preview-disabled-card">
                <div className="schedule-card-head">
                  <div>
                    <p className="eyebrow">ZeitPlan</p>
                    <h3>{selectedDate} 夜间计划</h3>
                    <p className="preview-card-caption">夜计划未启用，当前不会导出夜间图，也不会计入统计。</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
