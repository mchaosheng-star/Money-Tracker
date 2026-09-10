const STORAGE_KEY = "income-track-entries";
const LAST_CAT_KEY = "income-track-last-category";
const COLORS = [
  "#0f6b5c", "#1a8f7a", "#3aa68f", "#6bbf9e",
  "#c4a35a", "#d4b06a", "#8a9bb5", "#5c7a8a",
  "#2d6a5a", "#4a9e88", "#b8954a", "#7a8fa3",
];

const form = document.getElementById("incomeForm");
const dateInput = document.getElementById("date");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const categoryList = document.getElementById("categoryList");
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
categoryInput.value = localStorage.getItem(LAST_CAT_KEY) || "";

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

function entriesForMonth(entries, d) {
  const key = monthKey(d);
  return entries
    .filter((e) => e.date.startsWith(key))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

function allCategories(entries) {
  const set = new Set();
  for (const e of entries) {
    if (e.category) set.add(e.category);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function categorySlices(entries, d) {
  const key = monthKey(d);
  const map = new Map();
  let sum = 0;
  for (const e of entries) {
    if (!e.date.startsWith(key)) continue;
    const cat = e.category || "Other";
    const amt = Number(e.amount);
    map.set(cat, (map.get(cat) || 0) + amt);
    sum += amt;
  }
  const labels = [...map.keys()];
  const data = labels.map((k) => map.get(k));
  return { labels, data, sum };
}

function dailyTotals(entries, d) {
  const days = daysInMonth(d);
  const totals = Array(days).fill(0);
  const key = monthKey(d);
  for (const e of entries) {
    if (!e.date.startsWith(key)) continue;
    totals[Number(e.date.slice(8, 10)) - 1] += Number(e.amount);
  }
  return totals;
}

function refreshCategoryList() {
  const cats = allCategories(loadEntries());
  categoryList.innerHTML = "";
  for (const c of cats) {
    const opt = document.createElement("option");
    opt.value = c;
    categoryList.append(opt);
  }
}

const chart = new Chart(document.getElementById("chart"), {
  type: "doughnut",
  data: {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [],
        borderWidth: 2,
        borderColor: "#fffaf3",
        hoverOffset: 6,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "68%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#5c6b65", boxWidth: 12, padding: 14 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => " " + money(ctx.parsed),
        },
      },
    },
  },
});

const dailyChart = new Chart(document.getElementById("dailyChart"), {
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
  const { labels, data, sum } = categorySlices(all, view);
  const totals = dailyTotals(all, view);

  monthTitle.textContent = view.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  monthTotal.textContent = money(sum);

  if (data.length === 0) {
    chart.data.labels = ["No income"];
    chart.data.datasets[0].data = [1];
    chart.data.datasets[0].backgroundColor = ["rgba(26, 36, 33, 0.12)"];
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = data.map((_, i) => COLORS[i % COLORS.length]);
  }
  chart.update();

  dailyChart.data.labels = totals.map((_, i) => String(i + 1));
  dailyChart.data.datasets[0].data = totals;
  dailyChart.update();

  refreshCategoryList();

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
    const detail = document.createElement("span");
    const parts = [e.category || "Other"];
    if (e.note) parts.push(e.note);
    detail.textContent = parts.join(" · ");
    meta.append(strong, detail);

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
  const category = categoryInput.value.trim();
  if (!dateInput.value || !(amount > 0) || !category) return;

  const entries = loadEntries();
  entries.push({
    id: Date.now(),
    date: dateInput.value,
    amount,
    category,
    note: noteInput.value.trim(),
  });
  saveEntries(entries);
  localStorage.setItem(LAST_CAT_KEY, category);

  const [y, m] = dateInput.value.split("-").map(Number);
  view = new Date(y, m - 1, 1);
  amountInput.value = "";
  noteInput.value = "";
  categoryInput.value = category;
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
