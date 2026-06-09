import "./DailyPlan.css";

const schedule = [
  {
    local: "10:30 – 11:00",
    beijing: "16:30 – 17:00",
    task: "每日计划",
    icon: "calendar",
  },
  {
    local: "11:00 – 11:30",
    beijing: "17:00 – 17:30",
    task: "发邮件-termin/论文",
    icon: "mail",
  },
  {
    local: "11:30 – 12:00",
    beijing: "17:30 – 18:00",
    task: "整理驾校信息",
    icon: "folder",
  },
  {
    local: "12:00 – 14:00",
    beijing: "18:00 – 20:00",
    task: "吃饭，午休",
    icon: "food",
    highlight: true,
  },
  {
    local: "14:00 – 14:30",
    beijing: "20:00 – 20:30",
    task: "telekom电话",
    icon: "phone",
  },
  {
    local: "14:30 – 15:30",
    beijing: "20:30 – 21:30",
    task: "开发计划项目",
    icon: "code",
  },
  {
    local: "15:30 – 16:00",
    beijing: "21:30 – 22:00",
    task: "看部署教程-nginx",
    icon: "monitor",
  },
  {
    local: "16:00 – 17:00",
    beijing: "22:00 – 23:00",
    task: "修文",
    icon: "edit",
  },
];

function Icon({ name }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "icon",
  };

  const icons = {
    clock: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    globe: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18" />
        <path d="M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
    list: (
      <svg {...commonProps}>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    ),
    calendar: (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4" />
        <path d="M8 3v4" />
        <path d="M3 10h18" />
      </svg>
    ),
    mail: (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
    folder: (
      <svg {...commonProps}>
        <path d="M3 7h7l2 3h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
    food: (
      <svg {...commonProps}>
        <path d="M6 3v8" />
        <path d="M9 3v8" />
        <path d="M6 8h3" />
        <path d="M7.5 11v10" />
        <path d="M17 3v18" />
        <path d="M14 3v7a3 3 0 0 0 3 3" />
      </svg>
    ),
    phone: (
      <svg {...commonProps}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.15 6.81 2 2 0 0 1 5.11 4.5h3a2 2 0 0 1 2 1.72c.13.98.35 1.93.66 2.84a2 2 0 0 1-.45 2.11L9.1 12.39a16 16 0 0 0 2.5 2.5l1.22-1.22a2 2 0 0 1 2.11-.45c.91.31 1.86.53 2.84.66A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    code: (
      <svg {...commonProps}>
        <path d="m16 18 6-6-6-6" />
        <path d="m8 6-6 6 6 6" />
      </svg>
    ),
    monitor: (
      <svg {...commonProps}>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    ),
    edit: (
      <svg {...commonProps}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    ),
  };

  return icons[name];
}

export default function DailyPlan() {
  return (
    <main className="daily-page">
      <section className="daily-container">
        <h1 className="daily-title">每日计划</h1>
        <div className="title-line" />

        <div className="schedule-card">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>
                  <span className="th-content">
                    <Icon name="clock" />
                    本地时间
                  </span>
                </th>
                <th>
                  <span className="th-content">
                    <Icon name="globe" />
                    北京时间
                  </span>
                </th>
                <th>
                  <span className="th-content">
                    <Icon name="list" />
                    任务
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {schedule.map((item, index) => (
                <tr key={index} className={item.highlight ? "highlight-row" : ""}>
                  <td>{item.local}</td>
                  <td>{item.beijing}</td>
                  <td>
                    <span className="task-cell">
                      <Icon name={item.icon} />
                      {item.task}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}