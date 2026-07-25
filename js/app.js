(function () {
  "use strict";

  const JSON_PATH = "data/timetable.json";
  let timetable = null;
  let filteredSessions = [];
  let viewMode = "agenda";

  const elements = {
    resultsSection: document.querySelector(".results-section"),
    sourceVersion: document.getElementById("source-version"),
    effectiveDate: document.getElementById("effective-date"),
    footerNote: document.getElementById("footer-note"),
    search: document.getElementById("course-search"),
    programme: document.getElementById("programme-filter"),
    semester: document.getElementById("semester-filter"),
    classFilter: document.getElementById("class-filter"),
    day: document.getElementById("day-filter"),
    teacher: document.getElementById("teacher-filter"),
    room: document.getElementById("room-filter"),
    slot: document.getElementById("slot-filter"),
    type: document.getElementById("type-filter"),
    clear: document.getElementById("clear-filters"),
    reload: document.getElementById("reload-data"),
    emptyClear: document.getElementById("empty-clear"),
    agendaButton: document.getElementById("agenda-view"),
    gridButton: document.getElementById("grid-view"),
    csvButton: document.getElementById("download-csv"),
    printButton: document.getElementById("print-timetable"),
    resultHeading: document.getElementById("result-heading"),
    statSessions: document.getElementById("stat-sessions"),
    statCourses: document.getElementById("stat-courses"),
    statClasses: document.getElementById("stat-classes"),
    statTeachers: document.getElementById("stat-teachers"),
    loading: document.getElementById("loading-state"),
    error: document.getElementById("error-state"),
    errorMessage: document.getElementById("error-message"),
    empty: document.getElementById("empty-state"),
    agenda: document.getElementById("agenda-results"),
    grid: document.getElementById("grid-results"),
  };

  const filterElements = [
    elements.search,
    elements.programme,
    elements.semester,
    elements.classFilter,
    elements.day,
    elements.teacher,
    elements.room,
    elements.slot,
    elements.type,
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function sortText(values) {
    return [...values].sort((a, b) => String(a).localeCompare(String(b)));
  }

  function getRoomGroup(room) {
    return String(room).split(" • ")[0];
  }

  function getSlot(slotId) {
    return timetable.timeSlots.find((slot) => Number(slot.id) === Number(slotId));
  }

  function getSessionTime(session) {
    const start = getSlot(session.startSlot);
    const end = getSlot(session.endSlot);
    if (!start || !end) return "";
    return `${start.time.split("–")[0]}–${end.time.split("–")[1]}`;
  }

  function getTeacherName(code) {
    return timetable.teachers[code] || code;
  }

  function getTeacherLabel(codes) {
    if (!codes || !codes.length) return "Not specified";
    return codes.map(getTeacherName).join(", ");
  }

  function option(select, value, label) {
    const node = document.createElement("option");
    node.value = String(value);
    node.textContent = label;
    select.appendChild(node);
  }

  function resetSelect(select, firstLabel) {
    select.replaceChildren();
    option(select, "", firstLabel);
  }

  function validateData(data) {
    const requiredArrays = ["days", "timeSlots", "sessions"];
    for (const key of requiredArrays) {
      if (!Array.isArray(data[key])) {
        throw new Error(`"${key}" must be an array in timetable.json.`);
      }
    }
    if (!data.teachers || typeof data.teachers !== "object") {
      throw new Error('"teachers" must be an object in timetable.json.');
    }
    for (const [index, session] of data.sessions.entries()) {
      const required = [
        "day",
        "programme",
        "semester",
        "classLabel",
        "startSlot",
        "endSlot",
        "course",
        "teachers",
        "room",
        "kind",
      ];
      const missing = required.filter((key) => session[key] === undefined);
      if (missing.length) {
        throw new Error(
          `Session ${index + 1} is missing: ${missing.join(", ")}.`,
        );
      }
    }
  }

  function populateFilters() {
    resetSelect(elements.programme, "All programmes");
    resetSelect(elements.semester, "All semesters");
    resetSelect(elements.classFilter, "All classes");
    resetSelect(elements.day, "All days");
    resetSelect(elements.teacher, "All teachers");
    resetSelect(elements.room, "All classrooms");
    resetSelect(elements.slot, "All periods");
    resetSelect(elements.type, "All session types");

    sortText(unique(timetable.sessions.map((item) => item.programme))).forEach(
      (value) => option(elements.programme, value, value),
    );

    const roman = { 1: "I", 3: "III", 5: "V", 7: "VII" };
    unique(timetable.sessions.map((item) => Number(item.semester)))
      .sort((a, b) => a - b)
      .forEach((value) =>
        option(elements.semester, value, `Semester ${roman[value] || value}`),
      );

    sortText(unique(timetable.sessions.map((item) => item.classLabel))).forEach(
      (value) => option(elements.classFilter, value, value),
    );

    timetable.days.forEach((value) => option(elements.day, value, value));

    const usedTeacherCodes = unique(
      timetable.sessions.flatMap((item) => item.teachers || []),
    ).sort((a, b) => getTeacherName(a).localeCompare(getTeacherName(b)));
    usedTeacherCodes.forEach((code) =>
      option(elements.teacher, code, `${getTeacherName(code)} (${code})`),
    );

    sortText(
      unique(timetable.sessions.map((item) => getRoomGroup(item.room))),
    ).forEach((value) => option(elements.room, value, value));

    timetable.timeSlots.forEach((slot) =>
      option(elements.slot, slot.id, `${slot.label} · ${slot.time}`),
    );

    sortText(unique(timetable.sessions.map((item) => item.kind))).forEach(
      (value) => option(elements.type, value, value),
    );
  }

  function getFilters() {
    return {
      search: elements.search.value.trim().toLowerCase(),
      programme: elements.programme.value,
      semester: elements.semester.value,
      classLabel: elements.classFilter.value,
      day: elements.day.value,
      teacher: elements.teacher.value,
      room: elements.room.value,
      slot: elements.slot.value,
      type: elements.type.value,
    };
  }

  function filterSessions() {
    if (!timetable) return;
    const filters = getFilters();
    filteredSessions = timetable.sessions.filter((session) => {
      if (filters.programme && session.programme !== filters.programme) return false;
      if (filters.semester && Number(session.semester) !== Number(filters.semester)) {
        return false;
      }
      if (filters.classLabel && session.classLabel !== filters.classLabel) return false;
      if (filters.day && session.day !== filters.day) return false;
      if (filters.teacher && !session.teachers.includes(filters.teacher)) return false;
      if (filters.room && getRoomGroup(session.room) !== filters.room) return false;
      if (
        filters.slot &&
        (Number(filters.slot) < Number(session.startSlot) ||
          Number(filters.slot) > Number(session.endSlot))
      ) {
        return false;
      }
      if (filters.type && session.kind !== filters.type) return false;

      if (filters.search) {
        const text = [
          session.course,
          session.classLabel,
          session.programme,
          session.room,
          session.kind,
          session.note || "",
          session.teachers.join(" "),
          getTeacherLabel(session.teachers),
        ]
          .join(" ")
          .toLowerCase();
        if (!text.includes(filters.search)) return false;
      }
      return true;
    });

    const activeCount = Object.values(filters).filter(Boolean).length;
    elements.clear.disabled = activeCount === 0;
    elements.clear.textContent = activeCount ? `Clear (${activeCount})` : "Clear";
    render();
  }

  function sessionCard(session, compact) {
    const teacherCodes = session.teachers.length
      ? session.teachers.join(" / ")
      : "Not specified";
    const periodCount = Number(session.endSlot) - Number(session.startSlot) + 1;
    const kindClass = `kind-${String(session.kind).toLowerCase()}`;

    if (compact) {
      return `
        <article class="session-card compact ${kindClass}">
          <div class="session-main">
            <span class="class-kicker">${escapeHtml(session.classLabel)}</span>
            <h3>${escapeHtml(session.course)}</h3>
            <p class="compact-meta">
              ${escapeHtml(getSessionTime(session))} · ${escapeHtml(session.room)}
            </p>
          </div>
        </article>
      `;
    }

    return `
      <article class="session-card ${kindClass}">
        <div class="session-time">
          <span>${escapeHtml(getSessionTime(session))}</span>
          ${
            periodCount > 1
              ? `<small>${periodCount} periods</small>`
              : ""
          }
        </div>
        <div class="session-main">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div>
              <span class="class-kicker">${escapeHtml(session.classLabel)}</span>
              <h3>${escapeHtml(session.course)}</h3>
            </div>
            <span class="kind-badge">${escapeHtml(session.kind)}</span>
          </div>
          <div class="session-meta">
            <span title="${escapeHtml(getTeacherLabel(session.teachers))}">
              <span class="meta-symbol" aria-hidden="true">T</span>
              ${escapeHtml(teacherCodes)}
            </span>
            <span>
              <span class="meta-symbol" aria-hidden="true">R</span>
              ${escapeHtml(session.room)}
            </span>
          </div>
          ${
            session.note
              ? `<p class="session-note">${escapeHtml(session.note)}</p>`
              : ""
          }
        </div>
      </article>
    `;
  }

  function renderAgenda() {
    const selectedDay = elements.day.value;
    const visibleDays = selectedDay ? [selectedDay] : timetable.days;
    const sections = visibleDays
      .map((day) => {
        const daySessions = filteredSessions
          .filter((session) => session.day === day)
          .sort(
            (a, b) =>
              Number(a.startSlot) - Number(b.startSlot) ||
              a.classLabel.localeCompare(b.classLabel),
          );
        if (!daySessions.length) return "";
        return `
          <section class="day-section">
            <div class="day-heading">
              <h3>${escapeHtml(day)}</h3>
              <span>${daySessions.length} session${daySessions.length === 1 ? "" : "s"}</span>
            </div>
            <div class="session-list">
              ${daySessions.map((session) => sessionCard(session, false)).join("")}
            </div>
          </section>
        `;
      })
      .join("");
    elements.agenda.innerHTML = sections;
  }

  function renderGrid() {
    const selectedDay = elements.day.value;
    const visibleDays = selectedDay ? [selectedDay] : timetable.days;
    const head = timetable.timeSlots
      .map(
        (slot) => `
          <th scope="col">
            <span>${escapeHtml(slot.label)}</span>
            <small>${escapeHtml(slot.time)}</small>
          </th>
        `,
      )
      .join("");

    const body = visibleDays
      .map((day) => {
        const cells = timetable.timeSlots
          .map((slot) => {
            const sessions = filteredSessions.filter(
              (session) =>
                session.day === day &&
                Number(session.startSlot) === Number(slot.id),
            );
            return `
              <td>
                ${
                  sessions.length
                    ? sessions.map((session) => sessionCard(session, true)).join("")
                    : '<span class="empty-cell">—</span>'
                }
              </td>
            `;
          })
          .join("");
        return `<tr><th scope="row">${escapeHtml(day)}</th>${cells}</tr>`;
      })
      .join("");

    elements.grid.innerHTML = `
      <table class="weekly-table">
        <caption class="visually-hidden">
          Weekly timetable with days as rows and periods as columns
        </caption>
        <thead><tr><th scope="col">Day</th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  function render() {
    const count = filteredSessions.length;
    elements.resultHeading.textContent = count
      ? `${count} scheduled session${count === 1 ? "" : "s"}`
      : "No matching sessions";

    elements.statSessions.textContent = String(count);
    elements.statCourses.textContent = String(
      unique(filteredSessions.map((item) => item.course)).length,
    );
    elements.statClasses.textContent = String(
      unique(filteredSessions.map((item) => item.classLabel)).length,
    );
    elements.statTeachers.textContent = String(
      unique(filteredSessions.flatMap((item) => item.teachers)).length,
    );

    elements.csvButton.disabled = count === 0;
    elements.empty.classList.toggle("d-none", count !== 0);
    elements.agenda.classList.toggle("d-none", count === 0 || viewMode !== "agenda");
    elements.grid.classList.toggle("d-none", count === 0 || viewMode !== "grid");

    if (count && viewMode === "agenda") renderAgenda();
    if (count && viewMode === "grid") renderGrid();
  }

  function setView(mode) {
    viewMode = mode;
    const agendaActive = mode === "agenda";
    elements.agendaButton.classList.toggle("active", agendaActive);
    elements.agendaButton.setAttribute("aria-pressed", String(agendaActive));
    elements.gridButton.classList.toggle("active", !agendaActive);
    elements.gridButton.setAttribute("aria-pressed", String(!agendaActive));
    render();
  }

  function clearFilters() {
    filterElements.forEach((element) => {
      element.value = "";
    });
    filterSessions();
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function downloadCsv() {
    const headers = [
      "Day",
      "Programme",
      "Class",
      "Semester",
      "Course",
      "Type",
      "Time",
      "Teacher codes",
      "Teachers",
      "Classroom",
      "Notes",
    ];
    const rows = filteredSessions.map((session) => [
      session.day,
      session.programme,
      session.classLabel,
      session.semester,
      session.course,
      session.kind,
      getSessionTime(session),
      session.teachers.join(" / "),
      getTeacherLabel(session.teachers),
      session.room,
      session.note || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "amu-cs-filtered-timetable.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function loadData() {
    elements.resultsSection.setAttribute("aria-busy", "true");
    elements.loading.classList.remove("d-none");
    elements.error.classList.add("d-none");
    elements.empty.classList.add("d-none");
    elements.agenda.classList.add("d-none");
    elements.grid.classList.add("d-none");
    elements.resultHeading.textContent = "Loading timetable…";
    elements.reload.disabled = true;

    try {
      const response = await fetch(`${JSON_PATH}?v=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      validateData(data);
      timetable = data;

      populateFilters();
      clearFilters();

      const metadata = timetable.metadata || {};
      elements.sourceVersion.textContent =
        metadata.version || "Timetable schedule";
      elements.effectiveDate.textContent = metadata.effectiveDate
        ? `Effective ${metadata.effectiveDate}`
        : "Effective date not specified";
      elements.footerNote.textContent = [
        metadata.version,
        metadata.effectiveDate
          ? `Effective ${metadata.effectiveDate}`
          : "",
        "Data: data/timetable.json",
      ]
        .filter(Boolean)
        .join(" · ");
    } catch (error) {
      timetable = null;
      filteredSessions = [];
      elements.loading.classList.add("d-none");
      elements.error.classList.remove("d-none");
      elements.resultHeading.textContent = "Timetable unavailable";
      elements.errorMessage.textContent =
        `${error.message} Start a local web server (for example, VS Code Live Server) instead of opening index.html directly.`;
    } finally {
      elements.resultsSection.setAttribute("aria-busy", "false");
      elements.loading.classList.add("d-none");
      elements.reload.disabled = false;
    }
  }

  function bindEvents() {
    elements.search.addEventListener("input", filterSessions);
    [
      elements.day,
      elements.teacher,
      elements.room,
      elements.slot,
      elements.type,
    ].forEach((element) => element.addEventListener("change", filterSessions));

    elements.programme.addEventListener("change", () => {
      if (elements.classFilter.value) elements.semester.value = "";
      elements.classFilter.value = "";
      filterSessions();
    });

    elements.semester.addEventListener("change", () => {
      elements.classFilter.value = "";
      filterSessions();
    });

    elements.classFilter.addEventListener("change", () => {
      if (elements.classFilter.value && timetable) {
        const sample = timetable.sessions.find(
          (session) => session.classLabel === elements.classFilter.value,
        );
        if (sample) {
          elements.programme.value = sample.programme;
          elements.semester.value = String(sample.semester);
        }
      }
      filterSessions();
    });

    elements.clear.addEventListener("click", clearFilters);
    elements.emptyClear.addEventListener("click", clearFilters);
    elements.reload.addEventListener("click", loadData);
    elements.agendaButton.addEventListener("click", () => setView("agenda"));
    elements.gridButton.addEventListener("click", () => setView("grid"));
    elements.csvButton.addEventListener("click", downloadCsv);
    elements.printButton.addEventListener("click", () => window.print());
  }

  bindEvents();
  loadData();
})();
