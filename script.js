const url = "http://lmpss3.dev.spsejecna.net/procedure.php?cmd=listCmd";

const username = "coffe";
const password = "kafe";

function make_base_auth(user, password) {
  return "Basic " + btoa(user + ":" + password);
}
const AUTH_HEADER = make_base_auth(username, password);
const PEOPLE_CMD = "getPeopleList";
const DRINKS_CMD = "getTypesList";
const SAVE_CMD = "saveDrinks";

const $ = (sel) => document.querySelector(sel);

function safeJsonStringify(x) {
  try { return JSON.stringify(x, null, 2); } catch { return String(x); }
}

function setStatus(msg, type = "") {
  const el = $("#status");
  if (!el) return;
  el.className = "status" + (type ? ` status--${type}` : "");
  el.textContent = msg || "";
}

function normalizeList(apiResponse) {
  if (!apiResponse) return [];
  if (Array.isArray(apiResponse)) return apiResponse;

  if (typeof apiResponse === "object") {
    const commonKeys = ["data", "types", "items", "result", "rows", "list"];
    for (const k of commonKeys) {
      if (Array.isArray(apiResponse[k])) return apiResponse[k];
    }
    return Object.values(apiResponse);
  }
  return [];
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return undefined;
}

function setCookie(name, value, days = 30) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ` +
    `expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const n = encodeURIComponent(name) + "=";
  const parts = document.cookie.split(";").map(p => p.trim());
  for (const p of parts) {
    if (p.startsWith(n)) return decodeURIComponent(p.substring(n.length));
  }
  return null;
}

const LAST_USER_KEY = "lastUserId";

function saveLastUser(userId) {
  const v = String(userId);
  sessionStorage.setItem(LAST_USER_KEY, v);
  localStorage.setItem(LAST_USER_KEY, v);
  setCookie(LAST_USER_KEY, v, 30);
}

function loadLastUser() {
  return (
    sessionStorage.getItem(LAST_USER_KEY) ||
    localStorage.getItem(LAST_USER_KEY) ||
    getCookie(LAST_USER_KEY)
  );
}

async function apiGet(cmd) {
  const res = await fetch(`${url}?cmd=${cmd}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Authorization": AUTH_HEADER
    }
  });

  if (!res.ok) throw new Error(`${cmd} HTTP ${res.status}`);
  return await res.json();
}
async function apiPostSaveDrinks(payload) {
  const res = await fetch(`${url}?cmd=saveDrinks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": AUTH_HEADER
    },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`saveDrinks HTTP ${res.status}`);
  }

  return await res.json();
}

function renderPeople(peopleApiResponse) {
  const wrap = $("#usersList");
  if (!wrap) return;

  wrap.innerHTML = "";
  const list = normalizeList(peopleApiResponse);
  const remembered = loadLastUser();

  list.forEach((p, idx) => {
    const userId = pick(p, ["ID", "id", "userId"]) ?? idx + 1;
    const userName = pick(p, ["name", "jmeno", "username"]) ?? `Uživatel ${userId}`;
    const id = `u_${userId}`;

    const chip = document.createElement("div");
    chip.className = "chip";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.id = id;
    radio.name = "user";
    radio.value = String(userId);
    radio.required = true;

    if (remembered && String(userId) === String(remembered)) {
      radio.checked = true;
    }

    radio.addEventListener("change", () => {
      if (radio.checked) saveLastUser(userId);
    });

    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = userName;

    chip.appendChild(radio);
    chip.appendChild(label);
    wrap.appendChild(chip);
  });
}

function renderDrinks(drinksApiResponse) {
  const grid = $("#drinksGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const list = normalizeList(drinksApiResponse);

  list.forEach((d, idx) => {
    const typeName = pick(d, ["typ", "type", "name", "title"]) ?? `Drink ${idx + 1}`;

    const card = document.createElement("div");
    card.className = "drink";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="drink__name">${typeName}</div>
    `;

    const stepper = document.createElement("div");
    stepper.className = "stepper";

    const btnMinus = document.createElement("button");
    btnMinus.type = "button";
    btnMinus.textContent = "–";

    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.step = "1";
    inp.inputMode = "numeric";
    inp.value = "0";
    inp.dataset.type = String(typeName);

    const btnPlus = document.createElement("button");
    btnPlus.type = "button";
    btnPlus.textContent = "+";

    btnMinus.addEventListener("click", () => {
      inp.value = String(Math.max(0, Number(inp.value || 0) - 1));
    });
    btnPlus.addEventListener("click", () => {
      inp.value = String(Number(inp.value || 0) + 1);
    });

    stepper.appendChild(btnMinus);
    stepper.appendChild(inp);
    stepper.appendChild(btnPlus);

    card.appendChild(left);
    card.appendChild(stepper);
    grid.appendChild(card);
  });
}

function collectDrinksPayload() {
  const inputs = Array.from(document.querySelectorAll("input[data-type]"));

  return inputs.map((inp) => ({
    type: String(inp.dataset.type),
    value: Number(inp.value || 0),
  }));
}

async function handleSubmit(e) {
  e.preventDefault();
  setStatus("");

  const userRadio = document.querySelector('input[name="user"]:checked');
  if (!userRadio) {
    setStatus("Vyber uživatele.", "err");
    return;
  }

  saveLastUser(userRadio.value);

  const drinks = collectDrinksPayload();

  const sum = drinks.reduce((acc, d) => acc + (d.value || 0), 0);
  if (sum <= 0) {
    setStatus("Zadej alespoň jednu hodnotu > 0.", "err");
    return;
  }

  const btn = $("#btnSubmit");
  btn.disabled = true;
  btn.textContent = "Odesílám…";

  const box = $("#responseBox");
  if (box) {
    box.classList.remove("is-visible");
    box.textContent = "";
  }

  try {
    const payload = {
      user: String(userRadio.value),
      drinks
    };

    const res = await apiPostSaveDrinks(payload);

    if (box) {
      box.textContent = safeJsonStringify(res);
      box.classList.add("is-visible");
    }

    setStatus("Odesláno ✓", "ok");
    document.querySelectorAll("input[data-type]").forEach(inp => {
  inp.value = 0;
});
  } catch (err) {
    console.error(err);
    if (box) {
      box.textContent = String(err);
      box.classList.add("is-visible");
    }
    setStatus("Chyba při odesílání.", "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Odeslat";
  }
}

async function loadAll() {
  setStatus("Načítám…");
  $("#responseBox")?.classList.remove("is-visible");
  $("#responseBox").textContent = "";

  try {
    const [people, drinks] = await Promise.all([
      apiGet(PEOPLE_CMD),
      apiGet(DRINKS_CMD),
    ]);

    renderPeople(people);
    renderDrinks(drinks);

    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Nepodařilo se načíst data.", "err");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("#form")?.addEventListener("submit", handleSubmit);
  $("#btnReload")?.addEventListener("click", loadAll);
  loadAll();
});
