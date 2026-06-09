import { useEffect, useState } from "react";
import { PencilLine, Plus, Trash2, X } from "lucide-react";
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
  };
}

export function TaskTypesPage() {
  const [types, setTypes] = useState<TaskTypeResponse[]>([]);
  const [form, setForm] = useState<TaskTypePayload>(createInitialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadTypes() {
    const nextTypes = await apiClient.getTaskTypes();
    setTypes(nextTypes);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapTypes() {
      try {
        const nextTypes = await apiClient.getTaskTypes();
        if (!cancelled) {
          setTypes(nextTypes);
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
      setFeedback(error instanceof Error ? error.message : "删除失败");
    }
  }

  return (
    <div className="page-stack">
      {feedback ? <div className="feedback-banner">{feedback}</div> : null}

      <section className="two-column-grid">
        <article className="content-panel">
          <div className="panel-header">
            <div>
              <h2>{editingId ? "编辑任务类型" : "新增任务类型"}</h2>
              <p>图标和描述会同步显示在日程表、统计页和投骰子记录里。</p>
            </div>
            {editingId ? (
              <button className="ghost-button" type="button" onClick={resetForm}>
                <X size={16} />
                取消编辑
              </button>
            ) : null}
          </div>

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

            <label className="field field-span-2">
              <span>描述</span>
              <input
                type="text"
                value={form.description}
                placeholder="这个类型通常用来做什么"
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
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

          <div className="type-preview-card">
            <span className="task-icon-wrap" style={{ backgroundColor: `${form.colorHex}22` }}>
              <TaskIcon iconKey={form.iconKey} className="task-icon" />
            </span>
            <div>
              <strong>{form.name || "预览中的任务类型"}</strong>
              <p>{form.description || "你选中的图标和描述会出现在日程与统计界面。"}</p>
            </div>
          </div>

          <div className="panel-actions align-start">
            <button className="primary-button" type="button" onClick={() => void submit()} disabled={isSaving}>
              <Plus size={16} />
              {isSaving ? "保存中..." : editingId ? "更新类型" : "创建类型"}
            </button>
            <button className="ghost-button" type="button" onClick={resetForm}>
              清空表单
            </button>
          </div>
        </article>

        <aside className="content-panel">
          <div className="panel-header">
            <div>
              <h2>类型库</h2>
              <p>这里可以直接编辑和删除任务类型，操作会实时影响后续计划的分类选择。</p>
            </div>
          </div>

          <div className="type-list">
            {types.map((type) => (
              <article key={type.id} className="type-row">
                <div className="type-row-main">
                  <span className="task-icon-wrap" style={{ backgroundColor: `${type.colorHex}22` }}>
                    <TaskIcon iconKey={type.iconKey} className="task-icon" />
                  </span>
                  <div>
                    <strong>{type.name}</strong>
                    <p>{type.description || "暂未填写描述"}</p>
                  </div>
                </div>

                <div className="type-row-actions">
                  <button
                    className="ghost-text-button"
                    type="button"
                    onClick={() => {
                      setEditingId(type.id);
                      setForm({
                        name: type.name,
                        iconKey: type.iconKey,
                        colorHex: type.colorHex || getTaskTypeColor(type.iconKey),
                        description: type.description,
                      });
                    }}
                  >
                    <PencilLine size={16} />
                    编辑
                  </button>
                  <button
                    className="ghost-text-button danger"
                    type="button"
                    onClick={() => void removeType(type.id)}
                  >
                    <Trash2 size={16} />
                    删除
                  </button>
                </div>
              </article>
            ))}

            {types.length === 0 ? <div className="empty-state">还没有任务类型，先创建一个吧。</div> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
