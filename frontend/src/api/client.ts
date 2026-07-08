import type {
  AdminOverviewResponse,
  AuthSessionResponse,
  DailyPlanPayload,
  DailyPlanResponse,
  DicePhase,
  DiceRollResponse,
  KindleCreateDeviceResponse,
  KindleDevicesResponse,
  KindleRepushResponse,
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

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function shouldRetryRequest(error: unknown) {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

async function retryRequest<T>(operation: () => Promise<T>, attempts = 3, delayMs = 700): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !shouldRetryRequest(error)) {
        break;
      }

      await wait(delayMs * attempt);
    }
  }

  throw lastError;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { suppressAuthEvent?: boolean; timeoutMs?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs;
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: init?.cache ?? "no-store",
      credentials: "include",
      ...init,
      signal: controller?.signal ?? init?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(0, "请求超时，请稍后再试。");
    }
    throw error;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }

  if (response.status === 401 && !options?.suppressAuthEvent) {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: { message?: string } | null = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const looksLikeHtml = text.trimStart().startsWith("<");
      throw new ApiError(
        response.status,
        looksLikeHtml
          ? "服务器返回了网页而不是 API 数据，可能是后端未启动或反向代理没有转到后端。"
          : "服务器返回了无法解析的数据。",
      );
    }
  }

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
  updateTaskTypeKeywords(id: number, keywords: string[]) {
    return request<TaskTypeResponse>(`/task-types/${id}/keywords`, {
      method: "PUT",
      body: JSON.stringify({ keywords }),
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
  getKindleDevices() {
    return retryRequest(
      () => request<KindleDevicesResponse>("/kindle/devices", undefined, { timeoutMs: 8000 }),
      3,
      600,
    );
  },
  createKindleDevice(name: string) {
    return request<KindleCreateDeviceResponse>("/kindle/devices", {
      method: "POST",
      body: JSON.stringify({ name }),
    }, { timeoutMs: 12000 });
  },
  repushKindleTodayPlan(deviceId: string) {
    return request<KindleRepushResponse>(`/kindle/devices/${deviceId}/repush-today-plan`, {
      method: "POST",
    }, { timeoutMs: 15000 });
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
