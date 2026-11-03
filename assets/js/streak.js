/* =========================================================
   Streak tracker
   State lives in data/streak.json in the repo. Reads and writes
   go through the GitHub Contents API using a fine-grained token
   that is stored only in this browser's localStorage.
   ========================================================= */
(function () {
    "use strict";

    const REPO = { owner: "cfandoh123", repo: "Portfolio", branch: "main", path: "data/streak.json" };
    const TOKEN_KEY = "calvin.streak.token";
    const API = "https://api.github.com/repos/" + REPO.owner + "/" + REPO.repo + "/contents/" + REPO.path;

    const $ = (id) => document.getElementById(id);
    const el = {
        task: $("streak-task"), range: $("streak-range"), doneBtn: $("done-btn"), missedBtn: $("missed-btn"), settingsBtn: $("settings-btn"),
        status: $("status"), months: $("months"), progress: $("progress"),
        current: $("st-current"), longest: $("st-longest"), done: $("st-done"), missed: $("st-missed"), left: $("st-left"),
        modal: $("settings"), inToken: $("in-token"), inTask: $("in-task"), inStart: $("in-start"), inMonths: $("in-months"),
        save: $("settings-save"), cancel: $("settings-cancel"), year: $("year")
    };

    let state = { task: "", start: "", months: 6, marks: {} };
    let sha = null;          // blob sha of the file on GitHub, needed for updates
    let busy = false;

    /* ---------- helpers ---------- */
    const pad = (n) => String(n).padStart(2, "0");
    const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
    const today = () => iso(new Date());

    function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
    function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

    const b64encode = (s) => btoa(unescape(encodeURIComponent(s)));
    const b64decode = (s) => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));

    function setStatus(msg, cls) {
        el.status.textContent = msg || "";
        el.status.className = "streak-status" + (cls ? " " + cls : "");
    }

    const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    function normalise(obj) {
        const marks = {};
        if (obj.marks && typeof obj.marks === "object") {
            Object.keys(obj.marks).forEach((d) => {
                if (isDate(d) && (obj.marks[d] === "done" || obj.marks[d] === "missed")) marks[d] = obj.marks[d];
            });
        }
        // legacy shape: a plain list of done days
        if (Array.isArray(obj.days)) obj.days.forEach((d) => { if (isDate(d) && !marks[d]) marks[d] = "done"; });
        return {
            task: typeof obj.task === "string" ? obj.task : "",
            start: typeof obj.start === "string" ? obj.start : "",
            months: Number(obj.months) > 0 ? Number(obj.months) : 6,
            marks: sortMarks(marks)
        };
    }
    function sortMarks(m) {
        const out = {};
        Object.keys(m).sort().forEach((k) => { out[k] = m[k]; });
        return out;
    }

    /* ---------- GitHub I/O ---------- */
    function headers(token) {
        return {
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + token,
            "X-GitHub-Api-Version": "2022-11-28"
        };
    }

    async function load() {
        const token = getToken();
        if (token) {
            const res = await fetch(API + "?ref=" + REPO.branch, { headers: headers(token), cache: "no-store" });
            if (res.status === 404) { sha = null; return normalise({}); }
            if (!res.ok) throw new Error("GitHub read failed (" + res.status + "). Check the token.");
            const json = await res.json();
            sha = json.sha;
            return normalise(JSON.parse(b64decode(json.content)));
        }
        // read-only fallback: the file as served by GitHub Pages
        const res = await fetch(REPO.path + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) throw new Error("Could not read " + REPO.path);
        return normalise(await res.json());
    }

    async function commit(next, message) {
        const token = getToken();
        if (!token) throw new Error("No token saved. Open Settings and add one.");
        const body = {
            message: message,
            content: b64encode(JSON.stringify(next, null, 2) + "\n"),
            branch: REPO.branch
        };
        if (sha) body.sha = sha;
        const res = await fetch(API, { method: "PUT", headers: headers(token), body: JSON.stringify(body) });
        if (res.status === 409 || res.status === 422) {
            // someone else (another device) wrote first: reload, merge marks, retry once
            const fresh = await load();
            const merged = Object.assign({}, next, { marks: sortMarks(Object.assign({}, fresh.marks, next.marks)) });
            body.content = b64encode(JSON.stringify(merged, null, 2) + "\n");
            body.sha = sha;
            const retry = await fetch(API, { method: "PUT", headers: headers(token), body: JSON.stringify(body) });
            if (!retry.ok) throw new Error("GitHub write failed (" + retry.status + ")");
            sha = (await retry.json()).content.sha;
            return merged;
        }
        if (!res.ok) throw new Error("GitHub write failed (" + res.status + "). Does the token have Contents: write?");
        sha = (await res.json()).content.sha;
        return next;
    }

    /* ---------- stats ---------- */
    function computeStats() {
        const marks = state.marks;
        const t = today();
        const start = state.start ? parse(state.start) : null;
        const end = start ? addDays(addMonths(start, state.months), -1) : null;

        // current streak: consecutive "done" days ending today, or yesterday if today isn't decided yet
        let cursor = parse(t);
        if (!marks[t]) cursor = addDays(cursor, -1);
        let current = 0;
        while (marks[iso(cursor)] === "done") { current++; cursor = addDays(cursor, -1); }

        // longest run of consecutive "done" days
        const doneDays = Object.keys(marks).filter((d) => marks[d] === "done");
        let longest = 0, run = 0, prev = null;
        doneDays.forEach((d) => {
            run = prev && iso(addDays(parse(prev), 1)) === d ? run + 1 : 1;
            longest = Math.max(longest, run);
            prev = d;
        });
        const missed = Object.keys(marks).filter((d) => marks[d] === "missed").length;

        let total = 0, left = 0, elapsed = 0;
        if (start && end) {
            total = Math.round((end - start) / 86400000) + 1;
            const now = parse(t);
            elapsed = Math.min(total, Math.max(0, Math.round((now - start) / 86400000) + 1));
            left = Math.max(0, total - elapsed);
        }
        return { current, longest, done: doneDays.length, missed, left, total, end };
    }

    /* ---------- render ---------- */
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const DOW = ["S", "M", "T", "W", "T", "F", "S"];

    function render() {
        const t = today();
        const marks = state.marks;
        const hasPlan = !!state.start;
        const s = computeStats();

        el.task.textContent = state.task || "Streak";
        if (hasPlan) {
            const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
            el.range.textContent = fmt(parse(state.start)) + " → " + fmt(s.end) + " · " + state.months + " months, one day at a time.";
        } else {
            el.range.textContent = "Open Settings to pick a task and a start date.";
        }

        el.current.textContent = s.current;
        el.longest.textContent = s.longest;
        el.done.textContent = s.done + (s.total ? " / " + s.total : "");
        el.missed.textContent = s.missed;
        el.left.textContent = s.left;
        el.progress.style.width = s.total ? Math.round((s.done / s.total) * 100) + "%" : "0%";

        const verdict = marks[t];
        el.doneBtn.classList.toggle("active", verdict === "done");
        el.missedBtn.classList.toggle("active", verdict === "missed");
        el.doneBtn.disabled = el.missedBtn.disabled = busy || !hasPlan || !getToken();

        el.months.innerHTML = "";
        if (!hasPlan) return;

        const start = parse(state.start);
        const end = s.end;
        const first = new Date(start.getFullYear(), start.getMonth(), 1);
        const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

        for (let m = new Date(first); m <= lastMonth; m = addMonths(m, 1)) {
            const box = document.createElement("div");
            box.className = "month";
            const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();

            let doneInMonth = 0, inRange = 0;
            const cells = [];
            for (let i = 0; i < m.getDay(); i++) cells.push('<div class="day blank"></div>');
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(m.getFullYear(), m.getMonth(), d);
                const key = iso(date);
                const cls = ["day"];
                if (date < start || date > end) cls.push("out");
                else {
                    inRange++;
                    if (marks[key] === "done") { cls.push("done"); doneInMonth++; }
                    else if (marks[key] === "missed") cls.push("missed");
                    else if (key < t) cls.push("pending");
                    else if (key > t) cls.push("future");
                }
                if (key === t) cls.push("today");
                cells.push('<div class="' + cls.join(" ") + '" title="' + key + '">' + d + "</div>");
            }

            box.innerHTML =
                '<div class="month-name"><span>' + MONTHS[m.getMonth()] + " " + m.getFullYear() + "</span>" +
                '<span class="muted">' + doneInMonth + " / " + inRange + "</span></div>" +
                '<div class="month-grid">' + DOW.map((d) => '<div class="dow">' + d + "</div>").join("") + cells.join("") + "</div>";
            el.months.appendChild(box);
        }
    }

    /* ---------- actions ---------- */
    async function setToday(verdict) {
        if (busy) return;
        const t = today();
        const marks = Object.assign({}, state.marks);
        const clearing = marks[t] === verdict;
        if (clearing) delete marks[t]; else marks[t] = verdict;

        const next = Object.assign({}, state, { marks: sortMarks(marks) });
        busy = true; render();
        setStatus(clearing ? "Clearing today's mark…" : "Committing today as " + verdict + "…");
        try {
            state = await commit(next, "streak: " + (clearing ? "clear " : verdict + " ") + t);
            if (clearing) setStatus("Cleared.", "ok");
            else if (verdict === "done") setStatus("Locked in. Nice.", "ok");
            else setStatus("Recorded. Tomorrow is a new day.", "ok");
        } catch (e) {
            setStatus(e.message, "err");
        } finally {
            busy = false; render();
        }
    }

    function openSettings() {
        el.inToken.value = getToken();
        el.inTask.value = state.task;
        el.inStart.value = state.start || today();
        el.inMonths.value = state.months;
        el.modal.hidden = false;
        setTimeout(() => (getToken() ? el.inTask : el.inToken).focus(), 30);
    }
    function closeSettings() { el.modal.hidden = true; }

    async function saveSettings() {
        setToken(el.inToken.value.trim());
        const next = Object.assign({}, state, {
            task: el.inTask.value.trim(),
            start: el.inStart.value,
            months: Math.max(1, Math.min(24, Number(el.inMonths.value) || 6))
        });
        const changed = next.task !== state.task || next.start !== state.start || next.months !== state.months;
        closeSettings();

        if (!getToken()) { setStatus("Token cleared. Page is read-only until you add one.", "err"); render(); return; }

        busy = true; render();
        try {
            if (sha === null) { state = await load(); }      // first time with a token: pick up the sha
            if (changed || sha === null) {
                const merged = Object.assign({}, state, { task: next.task, start: next.start, months: next.months });
                state = await commit(merged, "streak: update settings");
                setStatus("Settings saved.", "ok");
            } else {
                setStatus("Token saved.", "ok");
            }
        } catch (e) {
            setStatus(e.message, "err");
        } finally {
            busy = false; render();
        }
    }

    /* ---------- boot ---------- */
    el.doneBtn.addEventListener("click", () => setToday("done"));
    el.missedBtn.addEventListener("click", () => setToday("missed"));
    el.settingsBtn.addEventListener("click", openSettings);
    el.cancel.addEventListener("click", closeSettings);
    el.save.addEventListener("click", saveSettings);
    el.modal.addEventListener("click", (e) => { if (e.target === el.modal) closeSettings(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.modal.hidden) closeSettings(); });
    if (el.year) el.year.textContent = new Date().getFullYear();

    (async function init() {
        setStatus("Loading…");
        try {
            state = await load();
            setStatus(getToken() ? "" : "Read-only. Add a token in Settings to mark days.");
        } catch (e) {
            setStatus(e.message, "err");
        }
        render();
        if (!state.start) openSettings();
    })();
})();
