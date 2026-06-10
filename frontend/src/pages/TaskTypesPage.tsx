import { useEffect, useRef, useState, type DragEvent } from "react";
import { Check, GripVertical, PencilLine, Plus, Trash2, X } from "lucide-react";
import { apiClient } from "../api/client";
import type { TaskTypePayload, TaskTypeResponse } from "../api/types";
import { getTaskTypeColor, TASK_ICON_CHOICES } from "../lib/taskIconChoices";
import { TaskIcon } from "../lib/taskIcons";

function createInitialForm(): TaskTypePayload {
  return {
    name: "",
    iconKey: "sparkles",
    colorHex: getTaskTypeColor("sparkles"),
    description: "",
    focusTask: true,
  };
}

function moveTaskType(types: TaskTypeResponse[], draggedId: number, targetId: number) {
  const sourceIndex = types.findIndex((type) => type.id === draggedId);
  const targetIndex = types.findIndex((type) => type.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return types;
  }

  const nextTypes = [...types];
  const [movedType] = nextTypes.splice(sourceIndex, 1);
  nextTypes.splice(targetIndex, 0, movedType);

  return nextTypes.map((type, index) =>
    type.sortOrder === index ? type : { ...type, sortOrder: index },
  );
}

function hasSameOrder(left: TaskTypeResponse[], right: TaskTypeResponse[]) {
  return left.length === right.length && left.every((type, index) => type.id === right[index]?.id);
}

export function TaskTypesPage() {
  const [types, setTypes] = useState<TaskTypeResponse[]>([]);
  const [form, setForm] = useState<TaskTypePayload>(createInitialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const typesRef = useRef<TaskTypeResponse[]>([]);
  const dragStartOrderRef = useRef<TaskTypeResponse[] | null>(null);

  function replaceTypes(nextTypes: TaskTypeResponse[]) {
    typesRef.current = nextTypes;
    setTypes(nextTypes);
  }

  function updateTypes(updater: (current: TaskTypeResponse[]) => TaskTypeResponse[]) {
    setTypes((current) => {
      const nextTypes = updater(current);
      typesRef.current = nextTypes;
      return nextTypes;
    });
  }

  async function loadTypes() {
    const nextTypes = await apiClient.getTaskTypes();
    replaceTypes(nextTypes);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapTypes() {
      try {
        const nextTypes = await apiClient.getTaskTypes();
        if (!cancelled) {
          replaceTypes(nextTypes);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback(error instanceof Error ? error.message : "读取任务类型失败");
        }
      }
    }

    void bootstrapTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setForm(createInitialForm());
    setEditingId(null);
  }

  async function submit() {
    setIsSaving(true);
    setFeedback(null);

    try {
      if (editingId) {
        await apiClient.updateTaskType(editingId, form);
        setFeedback("任务类型已更新");
      } else {
        await apiClient.createTaskType(form);
        setFeedback("任务类型已创建");
      }
      await loadTypes();
      resetForm();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "保存任务类型失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeType(id: number) {
    if (!window.confirm("删除后，使用这个类型的任务会自动变成未分类。确认删除吗？")) {
      return;
    }

    try {
      await apiClient.deleteTaskType(id);
      setFeedback("任务类型已删除");
      await loadTypes();
      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "删除任务类型失败");
    }
  }

  function startEditing(type: TaskTypeResponse) {
    setEditingId(type.id);
    setForm({
      name: type.name,
      iconKey: type.iconKey,
      colorHex: type.colorHex || getTaskTypeColor(type.iconKey),
      description: type.description,
      focusTask: type.focusTask,
    });
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, typeId: number) {
    if (isReordering || typesRef.current.length < 2) {
      event.preventDefault();
      return;
    }

    dragStartOrderRef.current = [...typesRef.current];
    setDraggingId(typeId);
    setDropTargetId(typeId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(typeId));
  }

  function handleDragOver(event: DragEvent<HTMLElement>, targetId: number) {
    if (draggingId === null) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(targetId);

    if (targetId === draggingId) {
      return;
    }

    updateTypes((current) => moveTaskType(current, draggingId, targetId));
  }

  async function persistTypeOrder(nextTypes: TaskTypeResponse[], previousTypes: TaskTypeResponse[]) {
    if (hasSameOrder(nextTypes, previousTypes)) {
      return;
    }

    setIsReordering(true);
    setFeedback(null);

    try {
      const reorderedTypes = await apiClient.reorderTaskTypes(nextTypes.map((type) => type.id));
      replaceTypes(reorderedTypes);
      setFeedback("任务类型顺序已更新");
    } catch (error) {
      replaceTypes(previousTypes);
      setFeedback(error instanceof Error ? error.message : "更新任务类型顺序失败");
    } finally {
      setIsReordering(false);
    }
  }

  function handleDragEnd() {
    const previousTypes = dragStartOrderRef.current;
    const nextTypes = typesRef.current;

    setDraggingId(null);
    setDropTargetId(null);
    dragStartOrderRef.current = null;

    if (!previousTypes) {
      return;
    }

    void persistTypeOrder(nextTypes, previousTypes);
  }

  return (
    <div className="page-stack">
      {feedback ? <div className="feedback-banner">{feedback}</div> : null}

      <section className="two-column-grid types-layout">
        <article className="content-panel focus-panel types-library-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Library</p>
              <h2>任务类型库</h2>
              <p>先看已有分类，再决定是新增、编辑，还是直接拖动调整顺序。</p>
            </div>
            <span className="badge-soft">共 {types.length} 个类型</span>
          </div>

          <div className="type-list">
            {types.map((type) => {
              const isDragging = draggingId === type.id;
              const isDropTarget = dropTargetId === type.id && draggingId !== type.id;

              return (
                <article
                  key={type.id}
                  className={[
                    "type-row",
                    isDragging ? "dragging" : "",
                    isDropTarget ? "drop-target" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onDragOver={(event) => handleDragOver(event, type.id)}
                  onDrop={(event) => event.preventDefault()}
                >
                  <div className="type-row-main">
                    <span className="task-icon-wrap" style={{ backgroundColor: `${type.colorHex}22` }}>
                      <TaskIcon iconKey={type.iconKey} className="task-icon" />
                    </span>
                    <div className="type-row-copy">
                      <strong>{type.name}</strong>
                      <p>{type.description || "暂未填写描述"}</p>
                      <small className="type-focus-note">
                        {type.focusTask ? "计入专注时间统计" : "不计入专注时间统计"}
                      </small>
                    </div>
                  </div>

                  <div className="type-row-tail">
                    <div className="type-row-actions">
                      <button
                        className="ghost-text-button"
                        type="button"
                        onClick={() => startEditing(type)}
                        disabled={isReordering}
                      >
                        <PencilLine size={16} />
                        编辑
                      </button>
                      <button
                        className="ghost-text-button danger"
                        type="button"
                        onClick={() => void removeType(type.id)}
                        disabled={isReordering}
                      >
                        <Trash2 size={16} />
                        删除
                      </button>
                    </div>

                    <button
                      className={isDragging ? "drag-handle-button active" : "drag-handle-button"}
                      type="button"
                      title={types.length > 1 ? "按住拖动排序" : "至少需要两个类型才能排序"}
                      aria-label={`拖动排序 ${type.name}`}
                      draggable={types.length > 1 && !isReordering}
                      onDragStart={(event) => handleDragStart(event, type.id)}
                      onDragEnd={handleDragEnd}
                      disabled={types.length < 2 || isReordering}
                    >
                      <GripVertical size={18} />
                    </button>
                  </div>
                </article>
              );
            })}

            {types.length === 0 ? <div className="empty-state">还没有任务类型，先创建一个吧。</div> : null}
          </div>
        </article>

        <aside className="content-panel secondary-panel types-editor-panel">
          <div className="panel-header type-editor-header">
            <div>
              <p className="eyebrow">{editingId ? "Edit" : "Create"}</p>
              <h2>{editingId ? "编辑任务类型" : "新增任务类型"}</h2>
            </div>
            <button
              className="primary-button type-submit-button"
              type="button"
              onClick={() => void submit()}
              disabled={isSaving || isReordering}
            >
              {editingId ? <Check size={16} /> : <Plus size={16} />}
              {isSaving ? "保存中..." : editingId ? "更新类型" : "创建类型"}
            </button>
          </div>

          {editingId ? (
            <button className="ghost-text-button type-editor-cancel" type="button" onClick={resetForm} disabled={isSaving}>
              <X size={16} />
              取消编辑
            </button>
          ) : null}

          <div className="form-grid">
            <label className="field">
              <span>类型名称</span>
              <input
                type="text"
                value={form.name}
                placeholder="例如：深度工作、运动、做饭"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>专注统计</span>
              <button
                className={form.focusTask ? "toggle-chip active" : "toggle-chip"}
                type="button"
                onClick={() => setForm((current) => ({ ...current, focusTask: !current.focusTask }))}
                aria-pressed={form.focusTask}
              >
                {form.focusTask ? "计入专注时间" : "不计入专注时间"}
              </button>
            </label>

            <label className="field field-span-2">
              <span>描述</span>
              <input
                type="text"
                value={form.description}
                placeholder="这个类型通常用来做什么？"
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
          </div>

          <div className="type-preview-card">
            <span className="task-icon-wrap" style={{ backgroundColor: `${form.colorHex}22` }}>
              <TaskIcon iconKey={form.iconKey} className="task-icon" />
            </span>
            <div>
              <strong>{form.name || "预览中的任务类型"}</strong>
              <p>{form.description || "图标与描述会同步出现在日程与统计界面。"}</p>
              <small className="type-focus-note">
                {form.focusTask ? "当前会计入专注时间统计" : "当前不会计入专注时间统计"}
              </small>
            </div>
          </div>

          <div className="icon-picker">
            {TASK_ICON_CHOICES.map((choice) => (
              <button
                key={choice.key}
                type="button"
                className={form.iconKey === choice.key ? "icon-choice active" : "icon-choice"}
                title={choice.label}
                aria-label={choice.label}
                aria-pressed={form.iconKey === choice.key}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    iconKey: choice.key,
                    colorHex: choice.colorHex,
                  }))
                }
              >
                <span className="task-icon-wrap" style={{ backgroundColor: `${choice.colorHex}22` }}>
                  <TaskIcon iconKey={choice.key} className="task-icon" />
                </span>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
