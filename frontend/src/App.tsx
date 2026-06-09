import { useState, type ReactNode } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { CalendarDays, Dice5, LayoutDashboard, Shapes } from "lucide-react";
import type { SeasonMode } from "./api/types";
import { AdminPage } from "./pages/AdminPage";
import { DicePage } from "./pages/DicePage";
import { SchedulePage } from "./pages/SchedulePage";
import { TaskTypesPage } from "./pages/TaskTypesPage";

function AppLayout({
  seasonMode,
  onSeasonChange,
  children,
}: {
  seasonMode: SeasonMode;
  onSeasonChange: (value: SeasonMode) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand-block">
          <span className="brand-mark">Z</span>
          <div>
            <strong>ZeitPlan</strong>
            <p>德国本地 / 北京时间联动日程</p>
          </div>
        </div>

        <nav className="nav-links">
          <NavLink to="/" end>
            <CalendarDays size={16} />
            日程规划
          </NavLink>
          <NavLink to="/dice">
            <Dice5 size={16} />
            投骰子
          </NavLink>
          <NavLink to="/types">
            <Shapes size={16} />
            任务类型
          </NavLink>
          <NavLink to="/dashboard">
            <LayoutDashboard size={16} />
            后台统计
          </NavLink>
        </nav>

        <div className="season-menu">
          <button className="season-trigger" type="button">
            时差模式
            <strong>{seasonMode === "SUMMER" ? "夏令时" : "冬令时"}</strong>
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
      </header>

      <main className="main-shell">{children}</main>
    </div>
  );
}

export default function App() {
  const [seasonMode, setSeasonMode] = useState<SeasonMode>("SUMMER");

  return (
    <BrowserRouter>
      <AppLayout seasonMode={seasonMode} onSeasonChange={setSeasonMode}>
        <Routes>
          <Route path="/" element={<SchedulePage seasonMode={seasonMode} onSeasonSync={setSeasonMode} />} />
          <Route path="/types" element={<TaskTypesPage />} />
          <Route path="/dashboard" element={<AdminPage />} />
          <Route path="/dice" element={<DicePage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
