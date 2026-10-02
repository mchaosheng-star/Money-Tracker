const STORAGE_KEY = "income-track-entries";
const LAST_CAT_KEY = "income-track-last-category";
const CAT_META_KEY = "income-track-categories";

const PALETTE = [
  "#0f6b5c", "#1a8f7a", "#2d8cff", "#6b5cff",
  "#c45a8a", "#d46a4a", "#c4a35a", "#5c7a8a",
  "#3aa68f", "#8a5a2d", "#4a6fa5", "#b33a2b",
];

const form = document.getElementById("incomeForm");
const dateInput = document.getElementById("date");
const amountInput = document.getElementById("amount");
const noteInput = document.getElementById("note");
const catChips = document.getElementById("catChips");
const addCatBtn = document.getElementById("addCatBtn");
const newCatPanel = document.getElementById("newCatPanel");
const newCatName = document.getElementById("newCatName");
const newCatColors = document.getElementById("newCatColors");
const saveCatBtn = document.getElementById("saveCatBtn");
const cancelCatBtn = document.getElementById("cancelCatBtn");
const editColors = document.getElementById("editColors");
const entriesEl = document.getElementById("entries");
const emptyEl = document.getElementById("empty");
const monthTitle = document.getElementById("monthTitle");
const chartMonth = document.getElementById("chartMonth");
const monthTotal = document.getElementById("monthTotal");
const prevBtn = document.getElementById("prevMonth");
const nextBtn = document.getElementById("nextMonth");

let view = new Date();
view.setDate(1);
view.setHours(0, 0, 0, 0);

let selectedCategory = localStorage.getItem(LAST_CAT_KEY) || "";
let newCatColor = PALETTE[0];

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

function loadCategories() {
  let cats = [];
  try {
    cats = JSON.parse(localStorage.getItem(CAT_META_KEY) || "[]");
  } catch {
    cats = [];
  }
  if (!Array.isArray(cats)) cats = [];

  const names = new Set(cats.map((c) => c.name));
  const entries = loadEntries();
  let i = 0;
  let changed = false;
  for (const e of entries) {
    if (!e.category || names.has(e.category)) continue;
    cats.push({ name: e.category, color: PALETTE[i % PALETTE.length] });
    names.add(e.category);
    i++;
    changed = true;
  }
  if (changed) saveCategories(cats);
  return cats;
}

function saveCategories(cats) {
  localStorage.setItem(CAT_META_KEY, JSON.stringify(cats));
}

function getCatColor(name) {
  const found = loadCategories().find((c) => c.name === name);
  return found ? found.color : PALETTE[0];
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
  const colors = labels.map((k) => getCatColor(k));
  return { labels, data, sum, colors };
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

function paintColorRow(el, selected, onPick) {
  el.innerHTML = "";
  for (const c of PALETTE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (c === selected ? " on" : "");
    b.style.background = c;
    b.setAttribute("aria-label", c);
    b.addEventListener("click", () => {
      onPick(c);
      paintColorRow(el, c, onPick);
    });
    el.append(b);
  }
}

function renderChips() {
  const cats = loadCategories();
  catChips.innerHTML = "";

  if (!selectedCategory && cats.length) selectedCategory = cats[0].name;
  if (selectedCategory && !cats.some((c) => c.name === selectedCategory) && cats.length) {
    selectedCategory = cats[0].name;
  }

  if (!cats.length) {
    const hint = document.createElement("p");
    hint.className = "cat-hint";
    hint.textContent = "Tap + to add a category";
    catChips.append(hint);
  }

  for (const c of cats) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (c.name === selectedCategory ? " on" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(c.name === selectedCategory));
    const dot = document.createElement("i");
    dot.style.background = c.color;
    const label = document.createElement("span");
    label.textContent = c.name;
    btn.append(dot, label);
    btn.addEventListener("click", () => {
      selectedCategory = c.name;
      localStorage.setItem(LAST_CAT_KEY, c.name);
      renderChips();
    });
    catChips.append(btn);
  }

  const cur = cats.find((c) => c.name === selectedCategory);
  paintColorRow(editColors, cur ? cur.color : PALETTE[0], (color) => {
    if (!selectedCategory) return;
    const list = loadCategories();
    const item = list.find((c) => c.name === selectedCategory);
    if (!item) return;
    item.color = color;
    saveCategories(list);
    renderChips();
    updateChartsAndList();
  });
}

function openNewCat() {
  newCatPanel.classList.remove("hidden");
  newCatColor = PALETTE[loadCategories().length % PALETTE.length];
  newCatName.value = "";
  paintColorRow(newCatColors, newCatColor, (c) => {
    newCatColor = c;
  });
  newCatName.focus();
}

function closeNewCat() {
  newCatPanel.classList.add("hidden");
  newCatName.value = "";
}

addCatBtn.addEventListener("click", () => {
  if (newCatPanel.classList.contains("hidden")) openNewCat();
  else closeNewCat();
});

cancelCatBtn.addEventListener("click", closeNewCat);

saveCatBtn.addEventListener("click", () => {
  const name = newCatName.value.trim();
  if (!name) return;
  const cats = loadCategories();
  const existing = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.color = newCatColor;
    selectedCategory = existing.name;
  } else {
    cats.push({ name, color: newCatColor });
    selectedCategory = name;
  }
  saveCategories(cats);
  localStorage.setItem(LAST_CAT_KEY, selectedCategory);
  closeNewCat();
  render();
});

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

function updateChartsAndList() {
  const all = loadEntries();
  const monthEntries = entriesForMonth(all, view);
  const { labels, data, sum, colors } = categorySlices(all, view);
  const totals = dailyTotals(all, view);

  const monthLabel = view.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  monthTitle.textContent = monthLabel;
  chartMonth.textContent = monthLabel;
  monthTotal.textContent = money(sum);

  if (data.length === 0) {
    chart.data.labels = ["No income"];
    chart.data.datasets[0].data = [1];
    chart.data.datasets[0].backgroundColor = ["rgba(26, 36, 33, 0.12)"];
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
  }
  chart.update();

  dailyChart.data.labels = totals.map((_, i) => String(i + 1));
  dailyChart.data.datasets[0].data = totals;
  dailyChart.update();

  entriesEl.innerHTML = "";
  emptyEl.classList.toggle("show", monthEntries.length === 0);

  for (const e of monthEntries) {
    const li = document.createElement("li");

    const dot = document.createElement("i");
    dot.className = "entry-dot";
    dot.style.background = getCatColor(e.category || "Other");

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

    li.append(dot, meta, amt, del);
    entriesEl.append(li);
  }
}

function render() {
  renderChips();
  updateChartsAndList();
}

form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const amount = Number(amountInput.value);
  if (!dateInput.value || !(amount > 0) || !selectedCategory) {
    if (!selectedCategory) openNewCat();
    return;
  }

  const entries = loadEntries();
  entries.push({
    id: Date.now(),
    date: dateInput.value,
    amount,
    category: selectedCategory,
    note: noteInput.value.trim(),
  });
  saveEntries(entries);
  localStorage.setItem(LAST_CAT_KEY, selectedCategory);

  const [y, m] = dateInput.value.split("-").map(Number);
  view = new Date(y, m - 1, 1);
  amountInput.value = "";
  noteInput.value = "";
  amountInput.blur();
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
