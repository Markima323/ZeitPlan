import { useEffect, useMemo, useState } from "react";
import { Dice5, Gift, Sparkles } from "lucide-react";
import { apiClient } from "../api/client";
import type { DicePhase, DiceRollResponse } from "../api/types";
import { todayIsoDate } from "../lib/schedule";

function wait(duration: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function playRollSound() {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  const audioContext = new AudioContextConstructor();
  const now = audioContext.currentTime;

  [0, 0.12, 0.24, 0.36, 0.48].forEach((offset, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 380 + (index * 60);
    gain.gain.setValueAtTime(0.001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.07, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.12);
  });
}

export function DicePage() {
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [history, setHistory] = useState<DiceRollResponse[]>([]);
  const [hasPlan, setHasPlan] = useState(false);
  const [rollingValue, setRollingValue] = useState(1);
  const [latestRoll, setLatestRoll] = useState<DiceRollResponse | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function mergeHistory(nextRolls: DiceRollResponse[]) {
    return [...nextRolls].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  }

  async function loadData() {
    try {
      setFeedback(null);
      const [plan, nextHistory] = await Promise.all([
        apiClient.getPlan(selectedDate),
        apiClient.getDiceHistory(selectedDate),
      ]);
      setHasPlan(plan.tasks.length > 0);
      setHistory(mergeHistory(nextHistory));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "读取投骰子信息失败");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDicePage() {
      try {
        const [plan, nextHistory] = await Promise.all([
          apiClient.getPlan(selectedDate),
          apiClient.getDiceHistory(selectedDate),
        ]);

        if (!cancelled) {
          setHasPlan(plan.tasks.length > 0);
          setHistory(mergeHistory(nextHistory));
          setLatestRoll(nextHistory.at(-1) ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback(error instanceof Error ? error.message : "读取投骰子信息失败");
        }
      }
    }

    void bootstrapDicePage();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const nextPhase: DicePhase | null = useMemo(() => {
    if (history.length === 0) {
      return "MATERIAL";
    }

    if (history.length === 1) {
      return "PRAISE";
    }

    return null;
  }, [history.length]);

  const completedRollCount = Math.min(history.length, 2);

  const canRollToday = useMemo(() => {
    const today = todayIsoDate();
    const hour = new Date().getHours();
    return selectedDate === today && hour >= 17 && hasPlan && completedRollCount < 2 && nextPhase !== null;
  }, [completedRollCount, hasPlan, nextPhase, selectedDate]);

  const availabilityText = hasPlan ? "已识别到当日日计划" : "当天还没有日计划";
  const phaseText =
    nextPhase === "MATERIAL"
      ? "下一掷：物质奖励"
      : nextPhase === "PRAISE"
        ? "下一掷：夸夸奖励"
        : "今天的两次投掷都已完成";

  async function startRoll() {
    if (isRolling || !canRollToday || !nextPhase) {
      return;
    }

    setIsRolling(true);
    setFeedback(null);
    playRollSound();

    const intervalId = window.setInterval(() => {
      setRollingValue(Math.floor(Math.random() * 6) + 1);
    }, 110);

    try {
      const [result] = await Promise.all([apiClient.rollDice(selectedDate, nextPhase), wait(1500)]);
      setLatestRoll(result);
      setRollingValue(result.value);
      setHistory((current) => {
        if (current.some((item) => item.id === result.id)) {
          return current;
        }

        return mergeHistory([...current, result]);
      });
      await loadData();
    } catch (error) {
      await loadData();
      setFeedback(error instanceof Error ? error.message : "投骰子失败");
    } finally {
      window.clearInterval(intervalId);
      setIsRolling(false);
    }
  }

  return (
    <div className="page-stack">
      {feedback ? <div className="feedback-banner">{feedback}</div> : null}

      <section className="planner-layout dice-layout">
        <article className="content-panel focus-panel dice-main-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dice</p>
              <h2>今日投掷</h2>
            </div>
            <label className="field compact-field">
              <span>日期</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
          </div>

          <div className="dice-status-line">
            <span className="dice-status-pill">
              <Gift size={16} />
              {availabilityText}
            </span>
            <span className="dice-status-pill">
              <Sparkles size={16} />
              {phaseText}
            </span>
          </div>

          <div className="dice-stage">
            <div className={isRolling ? "die-card rolling" : "die-card"}>
              <Dice5 size={28} />
              <span className="die-value">{rollingValue}</span>
              <p>
                {nextPhase === "MATERIAL"
                  ? "第 1 次：物质奖励"
                  : nextPhase === "PRAISE"
                    ? "第 2 次：夸夸奖励"
                    : "今日已投完"}
              </p>
            </div>

            <button
              className="primary-button large-button"
              type="button"
              onClick={() => void startRoll()}
              disabled={!canRollToday || isRolling}
            >
              {isRolling
                ? "骰子滚动中..."
                : nextPhase === "MATERIAL"
                  ? "投第 1 次骰子"
                  : nextPhase === "PRAISE"
                    ? "投第 2 次骰子"
                    : "今日已结束"}
            </button>

            {latestRoll ? (
              <div className="result-banner">
                <strong>{latestRoll.phase === "MATERIAL" ? "物质奖励" : "夸夸奖励"}</strong>
                <p>
                  掷出了 {latestRoll.value} 点，{latestRoll.rewardUnlocked ? "命中奖励" : "这次没有命中"}。
                </p>
                <small>{latestRoll.message}</small>
              </div>
            ) : null}
          </div>
        </article>

        <aside className="content-panel secondary-panel history-panel dice-history-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">History</p>
              <h2>投掷记录</h2>
              <p>历史结果保持在侧边查看，不打断当前的投掷动作。</p>
            </div>
          </div>

          <div className="history-list">
            {history.map((item) => (
              <article key={item.id} className="history-row">
                <div>
                  <strong>{item.phase === "MATERIAL" ? "物质奖励" : "夸夸奖励"}</strong>
                  <p>{item.message}</p>
                </div>
                <div className="history-meta">
                  <span>{item.value} 点</span>
                  <small>
                    {new Date(item.createdAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              </article>
            ))}

            {history.length === 0 ? <div className="empty-state">这一天还没有投骰子记录。</div> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
