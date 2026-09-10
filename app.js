const STORAGE_KEY = "income-track-entries";

const form = document.getElementById("incomeForm");
const dateInput = document.getElementById("date");
const amountInput = document.getElementById("amount");
const noteInput = document.getElementById("note");
const entriesEl = document.getElementById("entries");
const emptyEl = document.getElementById("empty");
const monthTitle = document.getElementById("monthTitle");
const monthTotal = document.getElementById("monthTotal");
const prevBtn = document.getElementById("prevMonth");
const nextBtn = document.getElementById("nextMonth");

let view = new Date();
view.setDate(1);
view.setHours(0, 0, 0, 0);

dateInput.value = todayISO();

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function money(n) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function entriesForMonth(entries, d) {
  const key = monthKey(d);
  return entries
    .filter((e) => e.date.startsWith(key))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

function dailyTotals(entries, d) {
  const days = daysInMonth(d);
  const totals = Array(days).fill(0);
  const key = monthKey(d);
  for (const e of entries) {
    if (!e.date.startsWith(key)) continue;
    const day = Number(e.date.slice(8, 10));
    totals[day - 1] += Number(e.amount);
  }
  return totals;
}

const chart = new Chart(document.getElementById("chart"), {
  type: "bar",
  data: {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: "rgba(15, 107, 92, 0.75)",
        hoverBackgroundColor: "rgba(10, 79, 68, 0.9)",
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 28,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => money(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#5c6b65", maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(26, 36, 33, 0.08)" },
        ticks: {
          color: "#5c6b65",
          callback: (v) => "$" + v,
        },
      },
    },
  },
});

function render() {
  const all = loadEntries();
  const monthEntries = entriesForMonth(all, view);
  const totals = dailyTotals(all, view);
  const sum = monthEntries.reduce((s, e) => s + Number(e.amount), 0);

  monthTitle.textContent = view.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  monthTotal.textContent = money(sum);

  chart.data.labels = totals.map((_, i) => String(i + 1));
  chart.data.datasets[0].data = totals;
  chart.update();

  entriesEl.innerHTML = "";
  emptyEl.classList.toggle("show", monthEntries.length === 0);

  for (const e of monthEntries) {
    const li = document.createElement("li");
    const meta = document.createElement("div");
    meta.className = "meta";
    const strong = document.createElement("strong");
    strong.textContent = new Date(e.date + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const note = document.createElement("span");
    note.textContent = e.note || "—";
    meta.append(strong, note);

    const amt = document.createElement("div");
    amt.className = "amt";
    amt.textContent = money(Number(e.amount));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      saveEntries(loadEntries().filter((x) => x.id !== e.id));
      render();
    });

    li.append(meta, amt, del);
    entriesEl.append(li);
  }
}

form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const amount = Number(amountInput.value);
  if (!dateInput.value || !(amount > 0)) return;

  const entries = loadEntries();
  entries.push({
    id: Date.now(),
    date: dateInput.value,
    amount,
    note: noteInput.value.trim(),
  });
  saveEntries(entries);

  const [y, m] = dateInput.value.split("-").map(Number);
  view = new Date(y, m - 1, 1);
  amountInput.value = "";
  noteInput.value = "";
  render();
});

prevBtn.addEventListener("click", () => {
  view.setMonth(view.getMonth() - 1);
  render();
});

nextBtn.addEventListener("click", () => {
  view.setMonth(view.getMonth() + 1);
  render();
});

render();
