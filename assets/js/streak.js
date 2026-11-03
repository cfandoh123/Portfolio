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
        task: $("streak-task"), range: $("streak-range"), mark: $("mark-btn"), settingsBtn: $("settings-btn"),
        status: $("status"), months: $("months"), progress: $("progress"),
        current: $("st-current"), longest: $("st-longest"), done: $("st-done"), left: $("st-left"),
        modal: $("settings"), inToken: $("in-token"), inTask: $("in-task"), inStart: $("in-start"), inMonths: $("in-months"),
        save: $("settings-save"), cancel: $("settings-cancel"), year: $("year")
    };

    let state = { task: "", start: "", months: 6, days: [] };
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

    function normalise(obj) {
        const days = Array.isArray(obj.days) ? obj.days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
        return {
            task: typeof obj.task === "string" ? obj.task : "",
            start: typeof obj.start === "string" ? obj.start : "",
            months: Number(obj.months) > 0 ? Number(obj.months) : 6,
            days: Array.from(new Set(days)).sort()
        };
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
            const merged = Object.assign({}, next, { days: Array.from(new Set(fresh.days.concat(next.days))).sort() });
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
        const set = new Set(state.days);
        const t = today();
        const start = state.start ? parse(state.start) : null;
        const end = start ? addDays(addMonths(start, state.months), -1) : null;

        // current streak: count back from today, or from yesterday if today isn't marked yet
        let cursor = parse(t);
        if (!set.has(t)) cursor = addDays(cursor, -1);
        let current = 0;
        while (set.has(iso(cursor))) { current++; cursor = addDays(cursor, -1); }

        // longest run
        let longest = 0, run = 0, prev = null;
        state.days.forEach((d) => {
            run = prev && iso(addDays(parse(prev), 1)) === d ? run + 1 : 1;
            longest = Math.max(longest, run);
            prev = d;
        });

        let total = 0, left = 0, elapsed = 0;
        if (start && end) {
            total = Math.round((end - start) / 86400000) + 1;
            const now = parse(t);
            elapsed = Math.min(total, Math.max(0, Math.round((now - start) / 86400000) + 1));
            left = Math.max(0, total - elapsed);
        }
        return { current, longest, done: set.size, left, total, end };
    }

    /* ---------- render ---------- */
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const DOW = ["S", "M", "T", "W", "T", "F", "S"];

    function render() {
        const t = today();
        const set = new Set(state.days);
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
        el.left.textContent = s.left;
        el.progress.style.width = s.total ? Math.round((s.done / s.total) * 100) + "%" : "0%";

        const markedToday = set.has(t);
        el.mark.textContent = markedToday ? "✓ Done today" : "Mark today";
        el.mark.classList.toggle("btn-done", markedToday);
        el.mark.classList.toggle("btn-primary", !markedToday);
        el.mark.disabled = busy || !hasPlan || !getToken();

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
                    if (set.has(key)) { cls.push("done"); doneInMonth++; }
                    else if (key < t) cls.push("missed");
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
    async function toggleToday() {
        if (busy) return;
        const t = today();
        const set = new Set(state.days);
        const undo = set.has(t);
        if (undo && !confirm("Unmark today?")) return;
        undo ? set.delete(t) : set.add(t);

        const next = Object.assign({}, state, { days: Array.from(set).sort() });
        busy = true; render();
        setStatus(undo ? "Removing today's mark…" : "Committing today's mark…");
        try {
            state = await commit(next, (undo ? "streak: unmark " : "streak: mark ") + t);
            setStatus(undo ? "Removed." : "Day " + state.days.length + " locked in. Nice.", "ok");
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
    el.mark.addEventListener("click", toggleToday);
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
