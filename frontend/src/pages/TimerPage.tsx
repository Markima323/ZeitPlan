import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Clock3, RotateCcw } from "lucide-react";

const DEFAULT_DURATION_MINUTES = 5;
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 180;
const PRESET_MINUTES = [5, 10, 15, 25];

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getAudioContextConstructor() {
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

export function TimerPage() {
  const deadlineRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_DURATION_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const statusText = useMemo(() => {
    if (isRunning) {
      return "倒计时进行中";
    }

    if (remainingSeconds === 0) {
      return "时间到，可以休息结束或切换到下一项任务了";
    }

    return "准备好后点击开始，结束时会播放提示音";
  }, [isRunning, remainingSeconds]);

  async function prepareAudio() {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    // Play an almost-silent blip during the user gesture so mobile browsers fully unlock audio playback.
    const oscillator = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    const now = audioContextRef.current.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, now);
    oscillator.connect(gain);
    gain.connect(audioContextRef.current.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.01);
  }

  async function playCompletionSound() {
    const AudioContextConstructor = getAudioContextConstructor();
    if (
      (!audioContextRef.current || audioContextRef.current.state === "closed")
      && AudioContextConstructor
    ) {
      audioContextRef.current = new AudioContextConstructor();
    }

    const audioContext = audioContextRef.current;
    if (!audioContext) {
      return;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const now = audioContext.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const startAt = now + (index * 0.18);
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.16);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.18);
    });
  }

  function clampDuration(nextValue: number) {
    if (!Number.isFinite(nextValue)) {
      return DEFAULT_DURATION_MINUTES;
    }

    return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, Math.round(nextValue)));
  }

  function handleDurationChange(nextMinutes: number) {
    const clampedDuration = clampDuration(nextMinutes);
    setDurationMinutes(clampedDuration);
    if (!isRunning) {
      setRemainingSeconds(clampedDuration * 60);
      setCompletedAt(null);
    }
  }

  async function handleStartPause() {
    if (isRunning) {
      deadlineRef.current = null;
      setIsRunning(false);
      return;
    }

    await prepareAudio();

    const startingSeconds = remainingSeconds === 0 ? durationMinutes * 60 : remainingSeconds;
    deadlineRef.current = Date.now() + (startingSeconds * 1000);
    setRemainingSeconds(startingSeconds);
    setCompletedAt(null);
    setIsRunning(true);
  }

  function handleReset() {
    deadlineRef.current = null;
    setIsRunning(false);
    setRemainingSeconds(durationMinutes * 60);
    setCompletedAt(null);
  }

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (!deadline) {
        return;
      }

      const nextRemainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds((current) => (current === nextRemainingSeconds ? current : nextRemainingSeconds));

      if (nextRemainingSeconds > 0) {
        return;
      }

      deadlineRef.current = null;
      window.clearInterval(intervalId);
      setIsRunning(false);
      setCompletedAt(
        new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      void playCompletionSound();

      if ("vibrate" in navigator) {
        navigator.vibrate?.([120, 80, 120]);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning]);

  useEffect(() => {
    return () => {
      deadlineRef.current = null;
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
      }
    };
  }, []);

  return (
    <div className="page-stack">
      <section className="content-panel focus-panel timer-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Timer</p>
            <h2>专注计时器</h2>
            <p>默认 5 分钟，适合短休息、热身或临时专注冲刺。</p>
          </div>
        </div>

        <div className="timer-stage">
          <div className="timer-stage-copy">
            <span className="next-task-kicker">
              <Clock3 size={16} />
              {statusText}
            </span>
            <div className="timer-display" aria-live="polite">
              {formatRemainingTime(remainingSeconds)}
            </div>
            <p className="timer-support-copy">
              {isRunning
                ? "计时会继续保持在这个页面里运行。"
                : "修改分钟数后会自动重置到新的倒计时长度。"}
            </p>
          </div>

          <div className="timer-actions">
            <button className="primary-button large-button" type="button" onClick={() => void handleStartPause()}>
              <BellRing size={18} />
              {isRunning ? "暂停" : remainingSeconds === 0 ? "再来一次" : "开始倒计时"}
            </button>
            <button className="ghost-button" type="button" onClick={handleReset}>
              <RotateCcw size={18} />
              重置
            </button>
          </div>
        </div>

        <div className="timer-config-grid">
          <label className="field compact-field">
            <span>分钟数</span>
            <input
              type="number"
              min={MIN_DURATION_MINUTES}
              max={MAX_DURATION_MINUTES}
              step={1}
              value={durationMinutes}
              onChange={(event) => handleDurationChange(Number(event.target.value))}
            />
          </label>

          <div className="timer-presets" aria-label="倒计时预设">
            {PRESET_MINUTES.map((minutes) => (
              <button
                key={minutes}
                className={durationMinutes === minutes && !isRunning ? "timer-preset active" : "timer-preset"}
                type="button"
                onClick={() => handleDurationChange(minutes)}
              >
                {minutes} 分钟
              </button>
            ))}
          </div>
        </div>

        {completedAt ? (
          <div className="result-banner timer-result-banner">
            <strong>倒计时结束</strong>
            <p>{completedAt} 已触发提示音，你可以切换到下一项安排了。</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
