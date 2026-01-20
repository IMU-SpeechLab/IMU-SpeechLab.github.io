const state = {
  lang: document.body.dataset.lang || "zh",
  activeTab: "home",
  pubs: window.publications || [],
  pubYears: []
};

const i18n = {
  zh: {
    searchPlaceholder: "搜索标题、作者或期刊/会议",
    allYears: "全部年份",
    pubCount: (count) => `共 ${count} 篇`,
    pubEmpty: "暂无匹配论文。",
    studentsEmpty: "学生名单待更新。",
    alumniEmpty: "校友名单待更新。"
  },
  en: {
    searchPlaceholder: "Search title, authors, or venue",
    allYears: "All years",
    pubCount: (count) => `${count} publications`,
    pubEmpty: "No publications match the current filter.",
    studentsEmpty: "Student list coming soon.",
    alumniEmpty: "Alumni list coming soon."
  }
};

const studentGroupMeta = [
  { keys: ["phd", "博士"], titleZh: "博士", titleEn: "PhD" },
  { keys: ["master3", "硕士三年级"], titleZh: "硕士三年级", titleEn: "Master's Year 3" },
  { keys: ["master2", "硕士二年级"], titleZh: "硕士二年级", titleEn: "Master's Year 2" },
  { keys: ["master1", "硕士一年级"], titleZh: "硕士一年级", titleEn: "Master's Year 1" }
];

function pickLang(obj, base, lang) {
  const key = lang === "zh" ? `${base}Zh` : `${base}En`;
  return obj[key] || obj[`${base}En`] || obj[`${base}Zh`] || "";
}

function computeInitials(name) {
  if (!name) return "";
  if (/\p{Script=Han}/u.test(name)) {
    return name.slice(-2);
  }
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function personCard(person, lang, options = {}) {
  const name = pickLang(person, "name", lang);
  const title = pickLang(person, "title", lang);
  const bio = pickLang(person, "bio", lang);
  const note = pickLang(person, "note", lang) || pickLang(person, "dest", lang);
  const initials = person.initials || computeInitials(name);
  const link = person.link;
  const nameHtml = link
    ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${name}</a>`
    : name;

  return `
    <article class="person-card">
      <div class="person-header">
        <div class="avatar" data-photo="${person.photo || ""}" data-initials="${initials}" data-alt="${name}"></div>
        <div>
          <div class="person-name">${nameHtml}</div>
          ${title ? `<div class="person-title">${title}</div>` : ""}
          ${note ? `<div class="person-note">${note}</div>` : ""}
        </div>
      </div>
      ${options.showBio && bio ? `<p class="person-bio">${bio}</p>` : ""}
    </article>
  `;
}

function normalizeStudentGroups(raw, lang) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((group) => {
        const title = lang === "zh"
          ? group.titleZh || group.titleEn || ""
          : group.titleEn || group.titleZh || "";
        const items = Array.isArray(group.items) ? group.items : [];
        return { title, items };
      })
      .filter((group) => group.items.length);
  }
  if (typeof raw !== "object") return [];

  const groups = [];
  const metaKeys = new Set(studentGroupMeta.flatMap((meta) => meta.keys));

  studentGroupMeta.forEach((meta) => {
    const key = meta.keys.find((candidate) =>
      Object.prototype.hasOwnProperty.call(raw, candidate)
    );
    if (!key) return;
    const items = Array.isArray(raw[key]) ? raw[key] : [];
    if (!items.length) return;
    groups.push({ title: lang === "zh" ? meta.titleZh : meta.titleEn, items });
  });

  Object.keys(raw)
    .filter((key) => !metaKeys.has(key))
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      const items = Array.isArray(raw[key]) ? raw[key] : [];
      if (!items.length) return;
      groups.push({ title: key, items });
    });

  return groups;
}

function normalizeAlumniGroups(raw, lang) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.length ? [{ title: "", items: raw }] : [];
  }
  if (typeof raw !== "object") return [];

  const groups = [];
  const phdKey = ["phd", "博士"].find((key) =>
    Object.prototype.hasOwnProperty.call(raw, key)
  );
  const earlierKey = ["earlier", "更早"].find((key) =>
    Object.prototype.hasOwnProperty.call(raw, key)
  );
  if (phdKey) {
    const items = Array.isArray(raw[phdKey]) ? raw[phdKey] : [];
    if (items.length) {
      groups.push({ title: lang === "zh" ? "博士" : "PhD", items });
    }
  }

  const yearKeys = Object.keys(raw)
    .filter((key) => key !== phdKey && key !== earlierKey && /^\d{4}$/.test(key))
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  yearKeys.forEach((key) => {
    const items = Array.isArray(raw[key]) ? raw[key] : [];
    if (!items.length) return;
    groups.push({ title: key, items });
  });

  const otherKeys = Object.keys(raw)
    .filter((key) => key !== phdKey && key !== earlierKey && !/^\d{4}$/.test(key))
    .sort((a, b) => a.localeCompare(b));

  otherKeys.forEach((key) => {
    const items = Array.isArray(raw[key]) ? raw[key] : [];
    if (!items.length) return;
    groups.push({ title: key, items });
  });

  if (earlierKey) {
    const items = Array.isArray(raw[earlierKey]) ? raw[earlierKey] : [];
    if (items.length) {
      groups.push({ title: lang === "zh" ? "更早" : "Earlier", items });
    }
  }

  return groups;
}

function renderGroups(container, groups, lang, options = {}) {
  container.innerHTML = groups
    .map((group) => {
      const title = group.title ? `<div class="year-title">${group.title}</div>` : "";
      const items = group.items.map((person) => personCard(person, lang, options)).join("");
      return `
        <div class="year-group">
          ${title}
          <div class="card-grid">${items}</div>
        </div>
      `;
    })
    .join("");
}

function renderMembers(lang) {
  const data = window.siteMembers || { faculty: [], students: {}, alumni: {} };
  const facultyList = document.getElementById("faculty-list");
  const studentsList = document.getElementById("students-list");
  const alumniList = document.getElementById("alumni-list");
  const studentsEmpty = document.getElementById("students-empty");
  const alumniEmpty = document.getElementById("alumni-empty");

  facultyList.innerHTML = data.faculty
    .map((person) => personCard(person, lang, { showBio: true }))
    .join("");

  const studentGroups = normalizeStudentGroups(data.students, lang);
  if (studentGroups.length) {
    renderGroups(studentsList, studentGroups, lang, { showBio: false });
    studentsEmpty.hidden = true;
  } else {
    studentsList.innerHTML = "";
    studentsEmpty.textContent = i18n[lang].studentsEmpty;
    studentsEmpty.hidden = false;
  }

  const alumniGroups = normalizeAlumniGroups(data.alumni, lang);
  if (alumniGroups.length) {
    renderGroups(alumniList, alumniGroups, lang, { showBio: false });
    alumniEmpty.hidden = true;
  } else {
    alumniList.innerHTML = "";
    alumniEmpty.textContent = i18n[lang].alumniEmpty;
    alumniEmpty.hidden = false;
  }

  hydrateAvatars();
}

function hydrateAvatars() {
  document.querySelectorAll(".avatar").forEach((avatar) => {
    const src = avatar.dataset.photo;
    const alt = avatar.dataset.alt || "";
    if (!src) {
      return;
    }
    const img = document.createElement("img");
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.onload = () => {
      avatar.classList.add("has-photo");
    };
    img.onerror = () => {
      img.remove();
    };
    avatar.appendChild(img);
    img.src = encodeURI(src);
  });
}

function buildPubYears() {
  const yearSet = new Set();
  state.pubs.forEach((pub) => {
    if (pub.year) yearSet.add(pub.year);
  });
  state.pubYears = Array.from(yearSet).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
}

function updateYearOptions() {
  const select = document.getElementById("pub-year");
  const current = select.value || "all";
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = i18n[state.lang].allYears;
  select.appendChild(allOption);
  state.pubYears.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    select.appendChild(option);
  });
  if (["all", ...state.pubYears].includes(current)) {
    select.value = current;
  }
}

function renderPublications(list) {
  const listEl = document.getElementById("pub-list");
  const countEl = document.getElementById("pub-count");
  const emptyEl = document.getElementById("pub-empty");

  countEl.textContent = i18n[state.lang].pubCount(list.length);

  if (!list.length) {
    emptyEl.textContent = i18n[state.lang].pubEmpty;
    emptyEl.hidden = false;
    listEl.innerHTML = "";
    return;
  }

  emptyEl.hidden = true;

  const groups = new Map();
  list.forEach((pub) => {
    const year = pub.year || "Unknown";
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(pub);
  });

  const years = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return parseInt(b, 10) - parseInt(a, 10);
  });

  listEl.innerHTML = years
    .map((year) => {
      const items = groups
        .get(year)
        .map(
          (pub) => `
            <li class="pub-item">
              <div class="pub-title">${pub.title}</div>
              <div class="pub-meta">${pub.authors}</div>
              <div class="pub-meta">${pub.venue}</div>
            </li>
          `
        )
        .join("");

      return `
        <div class="pub-year-group">
          <div class="pub-year-title">${year}</div>
          <ul class="pub-items">${items}</ul>
        </div>
      `;
    })
    .join("");
}

function applyPubFilter() {
  const search = document.getElementById("pub-search");
  const yearSelect = document.getElementById("pub-year");
  const query = search.value.trim().toLowerCase();
  const year = yearSelect.value;

  const filtered = state.pubs.filter((pub) => {
    const haystack = `${pub.title} ${pub.authors} ${pub.venue}`.toLowerCase();
    if (year !== "all" && pub.year !== year) return false;
    if (query && !haystack.includes(query)) return false;
    return true;
  });

  renderPublications(filtered);
}

function setLang(lang) {
  state.lang = lang;
  document.body.dataset.lang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });

  const search = document.getElementById("pub-search");
  if (search) search.placeholder = i18n[lang].searchPlaceholder;

  updateYearOptions();
  applyPubFilter();
  renderMembers(lang);

  try {
    localStorage.setItem("imuLang", lang);
  } catch (err) {
    // ignore storage issues
  }
}

function setTab(tabId) {
  const panels = document.querySelectorAll(".tab-panel");
  const tabs = document.querySelectorAll(".tab-btn");

  panels.forEach((panel) => {
    const active = panel.id === tabId;
    panel.classList.toggle("is-active", active);
    panel.setAttribute("aria-hidden", String(!active));
  });

  tabs.forEach((btn) => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  state.activeTab = tabId;
  if (tabId) {
    history.replaceState(null, "", `#${tabId}`);
  }
}

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  const hash = window.location.hash.replace("#", "");
  if (hash) {
    setTab(hash);
  }
}

function initPublications() {
  state.pubs = state.pubs
    .slice()
    .sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
  buildPubYears();
  updateYearOptions();
  renderPublications(state.pubs);

  const search = document.getElementById("pub-search");
  const yearSelect = document.getElementById("pub-year");
  if (search) search.addEventListener("input", applyPubFilter);
  if (yearSelect) yearSelect.addEventListener("change", applyPubFilter);
}

function init() {
  initTabs();
  initPublications();

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  const savedLang = (() => {
    try {
      return localStorage.getItem("imuLang");
    } catch (err) {
      return null;
    }
  })();

  setLang(savedLang || state.lang);
}

init();
