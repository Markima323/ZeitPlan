import type {
  AdminOverviewResponse,
  AuthSessionResponse,
  DailyPlanPayload,
  DailyPlanResponse,
  DicePhase,
  DiceRollResponse,
  TaskTypePayload,
  TaskTypeResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
export const AUTH_REQUIRED_EVENT = "zeitplan:auth-required";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { suppressAuthEvent?: boolean },
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    ...init,
  });

  if (response.status === 401 && !options?.suppressAuthEvent) {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? "请求失败");
  }

  return data as T;
}

export const apiClient = {
  getSession() {
    return request<AuthSessionResponse>("/auth/session", undefined, {
      suppressAuthEvent: true,
    });
  },
  login(password: string) {
    return request<AuthSessionResponse>(
      "/auth/session",
      {
        method: "POST",
        body: JSON.stringify({ password }),
      },
      {
        suppressAuthEvent: true,
      },
    );
  },
  logout() {
    return request<void>(
      "/auth/session",
      {
        method: "DELETE",
      },
      {
        suppressAuthEvent: true,
      },
    );
  },
  getTaskTypes() {
    return request<TaskTypeResponse[]>("/task-types");
  },
  createTaskType(payload: TaskTypePayload) {
    return request<TaskTypeResponse>("/task-types", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateTaskType(id: number, payload: TaskTypePayload) {
    return request<TaskTypeResponse>(`/task-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  reorderTaskTypes(taskTypeIds: number[]) {
    return request<TaskTypeResponse[]>("/task-types/order", {
      method: "PUT",
      body: JSON.stringify({ taskTypeIds }),
    });
  },
  deleteTaskType(id: number) {
    return request<void>(`/task-types/${id}`, {
      method: "DELETE",
    });
  },
  getPlan(date: string) {
    return request<DailyPlanResponse>(`/plans/${date}`);
  },
  getLatestPlanBefore(date: string) {
    return request<DailyPlanResponse | undefined>(`/plans/latest?before=${date}`);
  },
  savePlan(date: string, payload: DailyPlanPayload) {
    return request<DailyPlanResponse>(`/plans/${date}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  getAdminOverview(fromDate: string, toDate: string) {
    return request<AdminOverviewResponse>(`/admin/overview?from=${fromDate}&to=${toDate}`);
  },
  getDiceHistory(date: string) {
    return request<DiceRollResponse[]>(`/plans/${date}/dice-rolls`);
  },
  rollDice(date: string, phase: DicePhase) {
    return request<DiceRollResponse>(`/plans/${date}/dice-rolls`, {
      method: "POST",
      body: JSON.stringify({ phase }),
    });
  },
};

export { ApiError };
