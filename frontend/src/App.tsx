import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { CalendarDays, Clock3, Dice5, House, LayoutDashboard, LogOut, Menu, Shapes, X } from "lucide-react";
import { AUTH_REQUIRED_EVENT, ApiError, apiClient } from "./api/client";
import type { AuthSessionResponse, SeasonMode } from "./api/types";
import { AdminPage } from "./pages/AdminPage";
import { DicePage } from "./pages/DicePage";
import { SchedulePage } from "./pages/SchedulePage";
import { TaskTypesPage } from "./pages/TaskTypesPage";
import { TimerPage } from "./pages/TimerPage";
import { TodayPlanPage } from "./pages/TodayPlanPage";

function LoginScreen({
  isSubmitting,
  feedback,
  onLogin,
}: {
  isSubmitting: boolean;
  feedback: string | null;
  onLogin: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(password);
  }

  return (
    <div className="auth-screen">
      <section className="content-panel focus-panel auth-card">
        <div className="auth-copy">
          <p className="eyebrow">Login</p>
          <h1 className="auth-title">每日计划</h1>
          <p className="hero-copy">
            第一次输入密码后，这台设备会通过安全 Cookie 保持登录。之后再次打开网站，会自动回到你的数据。
          </p>
        </div>

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>访问密码</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入你的站点密码"
            />
          </label>

          {feedback ? <div className="feedback-banner">{feedback}</div> : null}

          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting || password.trim() === ""}>
            {isSubmitting ? "登录中..." : "进入每日计划"}
          </button>
        </form>
      </section>
    </div>
  );
}

function AppLayout({
  seasonMode,
  onSeasonChange,
  onLogout,
  children,
}: {
  seasonMode: SeasonMode;
  onSeasonChange: (value: SeasonMode) => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
}) {
  const location = useLocation();
  const topNavRef = useRef<HTMLElement | null>(null);
  const [navOffset, setNavOffset] = useState(148);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navigationItems = [
    { to: "/", icon: House, label: "今日计划", end: true },
    { to: "/planner", icon: CalendarDays, label: "日程规划" },
    { to: "/timer", icon: Clock3, label: "计时器" },
    { to: "/dice", icon: Dice5, label: "投骰子" },
    { to: "/types", icon: Shapes, label: "任务类型" },
    { to: "/dashboard", icon: LayoutDashboard, label: "后台统计" },
  ];

  useLayoutEffect(() => {
    const topNav = topNavRef.current;
    if (!topNav) {
      return;
    }

    const updateOffset = () => {
      setNavOffset(Math.ceil(topNav.getBoundingClientRect().height) + 36);
    };

    updateOffset();

    const resizeObserver = new ResizeObserver(() => {
      updateOffset();
    });

    resizeObserver.observe(topNav);
    window.addEventListener("resize", updateOffset);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    const closeDrawerOnDesktop = () => {
      if (window.innerWidth > 820) {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener("resize", closeDrawerOnDesktop);
    return () => {
      window.removeEventListener("resize", closeDrawerOnDesktop);
    };
  }, []);

  const appShellStyle = {
    "--nav-offset": `${navOffset}px`,
  } as CSSProperties;

  return (
    <div className={isMobileNavOpen ? "app-shell mobile-nav-open" : "app-shell"} style={appShellStyle}>
      <header ref={topNavRef} className="top-nav">
        <div className="brand-block">
          <span className="brand-mark">Z</span>
          <div>
            <strong>ZeitPlan</strong>
            <p>德国本地 / 北京时间 · {seasonMode === "SUMMER" ? "夏令时" : "冬令时"}</p>
          </div>
        </div>

        <nav className="nav-links">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="nav-side-tools">
          <div className="season-menu">
            <button className="season-trigger" type="button">
              切换时差
            </button>
            <div className="season-dropdown">
              <button type="button" onClick={() => onSeasonChange("SUMMER")}>
                夏令时
                <small>德国时间 + 6 小时 = 北京时间</small>
              </button>
              <button type="button" onClick={() => onSeasonChange("WINTER")}>
                冬令时
                <small>德国时间 + 7 小时 = 北京时间</small>
              </button>
            </div>
          </div>

          <button className="ghost-button nav-logout-button" type="button" onClick={() => void onLogout()}>
            <LogOut size={16} />
            退出
          </button>
        </div>

        <button
          className="mobile-nav-toggle"
          type="button"
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-drawer"
          aria-label={isMobileNavOpen ? "关闭导航" : "打开导航"}
          onClick={() => setIsMobileNavOpen((current) => !current)}
        >
          {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <button
        className={isMobileNavOpen ? "mobile-nav-backdrop open" : "mobile-nav-backdrop"}
        type="button"
        aria-label="关闭导航遮罩"
        onClick={() => setIsMobileNavOpen(false)}
      />

      <aside
        id="mobile-drawer"
        className={isMobileNavOpen ? "mobile-drawer open" : "mobile-drawer"}
        aria-hidden={!isMobileNavOpen}
      >
        <div className="mobile-drawer-head">
          <div className="brand-block mobile-drawer-brand">
            <span className="brand-mark">Z</span>
            <div>
              <strong>ZeitPlan</strong>
              <p>德国本地 / 北京时间</p>
            </div>
          </div>

          <button
            className="mobile-drawer-close"
            type="button"
            aria-label="关闭导航"
            onClick={() => setIsMobileNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mobile-drawer-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={`mobile-${item.to}`}
                to={item.to}
                end={item.end}
                onClick={() => setIsMobileNavOpen(false)}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mobile-drawer-tools">
          <div className="mobile-season-group">
            <p className="mobile-drawer-label">时差模式</p>
            <button
              className={seasonMode === "SUMMER" ? "mobile-season-button active" : "mobile-season-button"}
              type="button"
              onClick={() => onSeasonChange("SUMMER")}
            >
              夏令时
              <small>德国时间 + 6 小时</small>
            </button>
            <button
              className={seasonMode === "WINTER" ? "mobile-season-button active" : "mobile-season-button"}
              type="button"
              onClick={() => onSeasonChange("WINTER")}
            >
              冬令时
              <small>德国时间 + 7 小时</small>
            </button>
          </div>

          <button
            className="ghost-button nav-logout-button mobile-logout-button"
            type="button"
            onClick={() => void onLogout()}
          >
            <LogOut size={16} />
            退出
          </button>
        </div>
      </aside>

      <main className="main-shell">{children}</main>
    </div>
  );
}

export default function App() {
  const [seasonMode, setSeasonMode] = useState<SeasonMode>("SUMMER");
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [loginFeedback, setLoginFeedback] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const nextSession = await apiClient.getSession();
        if (!cancelled) {
          setSession(nextSession);
          setAuthState("authenticated");
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 401) {
            setAuthState("unauthenticated");
            return;
          }

          setLoginFeedback(error instanceof Error ? error.message : "登录状态检查失败");
          setAuthState("unauthenticated");
        }
      }
    }

    void bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleAuthRequired() {
      setSession(null);
      setAuthState("unauthenticated");
      setLoginFeedback("登录已过期，请重新输入密码。");
    }

    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    };
  }, []);

  async function handleLogin(password: string) {
    setIsLoggingIn(true);
    setLoginFeedback(null);

    try {
      const nextSession = await apiClient.login(password.trim());
      setSession(nextSession);
      setAuthState("authenticated");
    } catch (error) {
      setLoginFeedback(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await apiClient.logout();
    } finally {
      setSession(null);
      setAuthState("unauthenticated");
      setLoginFeedback(null);
    }
  }

  if (authState === "loading") {
    return (
      <div className="auth-screen">
        <section className="content-panel focus-panel auth-card auth-loading-card">
          <p className="eyebrow">Loading</p>
          <h1 className="auth-title">每日计划</h1>
          <p className="hero-copy">正在确认这台设备的登录状态...</p>
        </section>
      </div>
    );
  }

  if (authState === "unauthenticated" || session == null) {
    return (
      <LoginScreen
        isSubmitting={isLoggingIn}
        feedback={loginFeedback}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <BrowserRouter>
      <AppLayout seasonMode={seasonMode} onSeasonChange={setSeasonMode} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<TodayPlanPage seasonMode={seasonMode} onSeasonSync={setSeasonMode} />} />
          <Route path="/planner" element={<SchedulePage seasonMode={seasonMode} onSeasonSync={setSeasonMode} />} />
          <Route path="/timer" element={<TimerPage />} />
          <Route path="/types" element={<TaskTypesPage />} />
          <Route path="/dashboard" element={<AdminPage />} />
          <Route path="/dice" element={<DicePage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
