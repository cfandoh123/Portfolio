/* =========================================================
   Calvin Andoh — Easter eggs
   ---------------------------------------------------------
   Nothing here touches the visible site. Triggers:
     · type "calvin" anywhere        → terminal
     · press ` (backtick)            → terminal
     · Konami code                   → terminal + confetti
     · click the Ghana flag (about)  → confetti
     · click the boba emoji (about)  → counter
     · open DevTools                 → console banner
   ========================================================= */

(function () {
    "use strict";

    /* ---------- Found-egg bookkeeping ---------- */
    const STORE = "calvin.eggs";
    const BOBA = "calvin.boba";

    function load(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch (e) { return fallback; }
    }
    function save(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
    function found(name) {
        const all = load(STORE, []);
        if (!all.includes(name)) { all.push(name); save(STORE, all); refreshScore(); }
    }
    function hasFound(name) { return load(STORE, []).includes(name); }
    function foundCount() { return EGGS.filter(([k]) => hasFound(k)).length; }

    const EGGS = [
        ["terminal", "the terminal you're standing in"],
        ["konami",   "up up down down left right left right b a"],
        ["flag",     "the Ghana flag on the about page remembers being clicked"],
        ["boba",     "so does the boba"],
        ["ttt",      "beat me at tic-tac-toe (you can't, but try)"]
    ];

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* =====================================================
       Confetti — Ghana flag colours
       ===================================================== */
    function confetti(originX, originY) {
        if (reduceMotion) return;
        const canvas = document.createElement("canvas");
        canvas.className = "egg-confetti";
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        document.body.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);

        const colors = ["#ce1126", "#fcd116", "#006b3f", "#000000", "#ffffff"];
        const x0 = originX ?? window.innerWidth / 2;
        const y0 = originY ?? window.innerHeight / 2;

        const bits = Array.from({ length: 90 }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 9;
            return {
                x: x0, y: y0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                size: 4 + Math.random() * 6,
                color: colors[(Math.random() * colors.length) | 0],
                spin: (Math.random() - 0.5) * 0.3,
                rot: Math.random() * Math.PI,
                star: Math.random() < 0.12
            };
        });

        const started = performance.now();
        (function frame(now) {
            const elapsed = now - started;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            bits.forEach((b) => {
                b.vy += 0.28;
                b.vx *= 0.99;
                b.x += b.vx;
                b.y += b.vy;
                b.rot += b.spin;
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(b.rot);
                ctx.globalAlpha = Math.max(0, 1 - elapsed / 2200);
                ctx.fillStyle = b.color;
                if (b.star) { drawStar(ctx, b.size); }
                else { ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * 0.6); }
                ctx.restore();
            });
            if (elapsed < 2200) { requestAnimationFrame(frame); }
            else { canvas.remove(); }
        })(started);
    }

    function drawStar(ctx, size) {
        const spikes = 5, outer = size, inner = size * 0.42;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outer : inner;
            const a = (Math.PI / spikes) * i - Math.PI / 2;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
    }

    /* =====================================================
       Terminal
       ===================================================== */
    const term = {
        el: null, out: null, input: null, open: false,
        history: [], histIndex: -1, mode: "shell", game: null
    };

    function build() {
        if (term.el) return;

        const wrap = document.createElement("div");
        wrap.className = "egg-term";
        wrap.setAttribute("role", "dialog");
        wrap.setAttribute("aria-modal", "true");
        wrap.setAttribute("aria-label", "Hidden terminal");
        wrap.innerHTML =
            '<div class="egg-term-panel">' +
                '<div class="egg-term-bar">' +
                    '<span class="egg-dot r"></span><span class="egg-dot y"></span><span class="egg-dot g"></span>' +
                    '<span class="egg-term-title">calvin@portfolio — ~</span>' +
                    '<button type="button" class="egg-term-close" aria-label="Close terminal">esc ✕</button>' +
                '</div>' +
                '<div class="egg-term-out" tabindex="0"></div>' +
                '<form class="egg-term-form" autocomplete="off">' +
                    '<span class="egg-ps1" aria-hidden="true">➜  ~</span>' +
                    '<input class="egg-term-input" type="text" spellcheck="false" autocapitalize="off" ' +
                        'autocorrect="off" aria-label="Terminal input" placeholder="type help">' +
                '</form>' +
            '</div>';

        document.body.appendChild(wrap);
        term.el = wrap;
        term.out = wrap.querySelector(".egg-term-out");
        term.input = wrap.querySelector(".egg-term-input");

        wrap.querySelector(".egg-term-close").addEventListener("click", close);
        wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
        wrap.querySelector(".egg-term-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const value = term.input.value;
            term.input.value = "";
            submit(value);
        });

        term.input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                if (!term.history.length) return;
                e.preventDefault();
                if (e.key === "ArrowUp") {
                    term.histIndex = term.histIndex < 0 ? term.history.length - 1 : Math.max(0, term.histIndex - 1);
                } else {
                    term.histIndex = term.histIndex < 0 ? -1 : term.histIndex + 1;
                    if (term.histIndex >= term.history.length) { term.histIndex = -1; term.input.value = ""; return; }
                }
                term.input.value = term.history[term.histIndex] || "";
            }
        });
    }

    function line(text, cls) {
        const el = document.createElement("span");
        el.className = "egg-l" + (cls ? " " + cls : "");
        el.innerHTML = text;
        term.out.appendChild(el);
        term.out.scrollTop = term.out.scrollHeight;
    }
    function lines(list, cls) { list.forEach((t) => line(t, cls)); }
    function gap() { line("", "gap"); }

    function openTerm(banner) {
        build();
        if (term.open) return;
        term.open = true;
        term.el.classList.add("open");
        document.documentElement.style.overflow = "hidden";
        found("terminal");
        if (banner !== false && !term.out.childNodes.length) welcome();
        setTimeout(() => term.input.focus(), 60);
    }

    function close() {
        if (!term.open) return;
        term.open = false;
        term.el.classList.remove("open");
        document.documentElement.style.overflow = "";
        term.mode = "shell";
        term.game = null;
    }

    function welcome() {
        lines([
            "  ____      _       _         ",
            " / ___|__ _| |_   _(_)_ __    ",
            "| |   / _` | \\ \\ / / | '_ \\   ",
            "| |__| (_| | |\\ V /| | | | |  ",
            " \\____\\__,_|_| \\_/ |_|_| |_|  "
        ], "accent");
        gap();
        line("You found it. Welcome to the part of the site that isn't for recruiters.", "dim");
        line('Type <span class="warm">help</span> to see what works, or <span class="warm">play</span> if you came to lose at tic-tac-toe.', "dim");
        gap();
    }

    function submit(raw) {
        const value = raw.trim();
        line('<span class="accent">➜  ~</span> ' + escapeHtml(raw));

        if (term.mode === "ttt") { tttInput(value); return; }

        if (!value) return;
        term.history.push(value);
        term.histIndex = -1;

        const parts = value.split(/\s+/);
        const name = parts[0].toLowerCase();
        const args = parts.slice(1);
        const cmd = COMMANDS[name];

        if (cmd) { cmd(args); }
        else {
            line("command not found: " + escapeHtml(name), "err");
            line('try <span class="warm">help</span>', "dim");
        }
        gap();
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => (
            { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
        ));
    }

    /* =====================================================
       Commands
       Everything below is public info that's already on the
       site — keep it that way if you edit it.
       ===================================================== */
    const COMMANDS = {
        help() {
            line("available commands", "head");
            gap();
            const rows = [
                ["whoami",    "the short version"],
                ["work",      "where I've spent my summers"],
                ["stack",     "what I actually reach for"],
                ["ghana",     "where I'm from"],
                ["teach",     "the part I'd do for free"],
                ["tech4good", "the thing I started"],
                ["projects",  "what I've shipped"],
                ["boba",      "important"],
                ["play",      "tic-tac-toe. I have never lost."],
                ["hire",      "the practical one"],
                ["secrets",   "eggs found vs. eggs remaining"],
                ["theme",     "flip light/dark from here"],
                ["clear",     "wipe the scrollback"],
                ["exit",      "back to the portfolio"]
            ];
            rows.forEach(([c, d]) => line('  <span class="warm">' + c.padEnd(11) + "</span>" + '<span class="dim">' + d + "</span>"));
        },

        whoami() {
            line("Calvin Andoh", "head");
            lines([
                "Rising senior at Princeton — B.S.E. Electrical &amp; Computer Engineering,",
                "minor in Computer Science. Class of 2027.",
                "Accra, Ghana → Princeton, New Jersey.",
                "Three summers at Google. Currently looking for new-grad SWE roles for 2027."
            ], "dim");
            gap();
            line("I like hard problems and I sweat the details of a good user experience.", "dim");
            line("That second part is why this terminal exists.", "dim");
        },

        work() {
            line("work history", "head");
            gap();
            const jobs = [
                ["2026", "Google · WearOS", "Cross-device transfer protocol in Play Services — no more factory resets when you upgrade your phone. gRPC APIs on the Wear OS Companion SDK."],
                ["2025", "Google · Earth AI", "End-to-end AI slideshow generation on the Gemini framework, across three stacks: LLM (C++), backend (Kotlin), frontend (Flutter). Cut agent error rates 15% → 5%."],
                ["2024", "Google · Fitbit", "Logging API tracking interactions across 5M+ users, plus an auto-deletion system for shared images."]
            ];
            jobs.forEach(([year, org, what]) => {
                line('  <span class="warm">' + year + "</span>  " + org);
                line("        " + what, "dim");
            });
            gap();
            line("Also: Code2040 Fellow, Uber Career Prep, Jane Street FOCUS, Palantir Launch.", "dim");
            line('Full list: <a href="experience.html">experience.html</a>', "dim");
        },

        stack() {
            line("languages", "head");
            line("  Java · Python · Go · Swift · C · C++ · JavaScript · TypeScript · SQL · R", "dim");
            gap();
            line("frameworks &amp; tools", "head");
            line("  React · Flutter · SwiftUI · PyTorch · Docker · Kubernetes · AWS · Azure", "dim");
            line("  PostgreSQL · MongoDB · Firebase · NumPy · Pandas · Git", "dim");
            gap();
            line("The honest answer is that the language matters less than whether", "dim");
            line("the thing works when someone who isn't me uses it.", "dim");
        },

        ghana() {
            line("🇬🇭  Ghana", "head");
            gap();
            lines([
                "Born and raised in Accra. The black star in the middle of the flag is",
                "the one on my favicon, and it's the reason Tech4Good exists — talent",
                "at home is not the bottleneck, pathways are.",
                "",
                "Before Princeton I was a Young Achievers Foundation scholar. YAF is now",
                "a Tech4Good bootcamp partner, which is a nice loop to have closed."
            ], "dim");
            if (!hasFound("flag")) {
                gap();
                line('<span class="ok">tip:</span> the flag on the about page is clickable.', "dim");
            }
        },

        teach() {
            line("teaching", "head");
            gap();
            lines([
                "Advanced Tutor at Princeton's McGraw Center since 2024 — study halls for",
                "200+ students in data structures &amp; algorithms, linear algebra,",
                "Calculus I–III, and physics.",
                "",
                "Explaining something badly is the fastest way to find out you don't",
                "understand it. Most of what I know well, I know because I had to teach it."
            ], "dim");
        },

        tech4good() {
            line("Tech4Good", "head");
            gap();
            lines([
                "41% of Ghana's 41,000+ cybercrime cases between 2019 and 2023 were online",
                "fraud, committed disproportionately by young people with real technical",
                "skill and no honest pathway to use it.",
                "",
                "Same skills. Different futures. Tech4Good is a bootcamp, a mentor network,",
                "and a free Python warm-up course, built with partners on the ground in Ghana."
            ], "dim");
            gap();
            line('  <a href="https://tech4good.live" target="_blank" rel="noopener">tech4good.live</a>', "warm");
            gap();
            line("If you've ever mentored someone into their first engineering job,", "dim");
            line("a few hours of your time goes further here than you'd think.", "dim");
        },

        projects() {
            line("selected projects", "head");
            gap();
            const list = [
                ["Tech4Good", "an initiative, a curriculum and a live site"],
                ["Equity Option Pricer", "8 pricing methods that all have to agree"],
                ["Delta-Hedging Simulator", "Monte-Carlo replication error, in your browser"],
                ["Radar Shape Classification", "a CNN reading FMCW range-angle heatmaps"],
                ["Princeton Esports", "built twice — React web and native SwiftUI"],
                ["Canine AI", "on-device dog breed ID"],
                ["MigrAid", "resource navigator for immigrants and refugees"]
            ];
            list.forEach(([n, d]) => line('  <span class="warm">' + n + "</span> — " + '<span class="dim">' + d + "</span>"));
            gap();
            line('All of them: <a href="projects.html">projects.html</a>', "dim");
        },

        boba() {
            const count = load(BOBA, 0);
            line("🧋  boba", "head");
            gap();
            // TODO(calvin): swap in your real order — this is the one line I couldn't
            // get from the site, so I left it vague on purpose.
            line("A non-trivial fraction of my problem-solving happens with a cup in hand.", "dim");
            gap();
            if (count > 0) {
                line("You've clicked the boba on the about page " + count + " time" + (count === 1 ? "" : "s") + ".", "ok");
            } else {
                line('<span class="ok">tip:</span> the boba on the about page is clickable too.', "dim");
            }
        },

        hire() {
            line("open to new-grad SWE roles starting 2027", "ok");
            gap();
            lines([
                '  résumé    <a href="Calvin_Andoh_Resume.pdf" target="_blank" rel="noopener">Calvin_Andoh_Resume.pdf</a>',
                '  email     <a href="mailto:ca0977@princeton.edu">ca0977@princeton.edu</a>',
                '  github    <a href="https://github.com/cfandoh123" target="_blank" rel="noopener">github.com/cfandoh123</a>',
                '  linkedin  <a href="https://www.linkedin.com/in/calvin-andoh-7a83481b5/" target="_blank" rel="noopener">in/calvin-andoh</a>'
            ]);
            gap();
            line("exit code 0", "dim");
        },

        sudo(args) {
            if (!args.length) { line("usage: sudo &lt;command&gt;", "dim"); return; }
            const rest = args.join(" ").toLowerCase();
            if (rest.startsWith("hire")) {
                line("Password:", "dim");
                line("calvin is not in the sudoers file. This incident has been reported.", "err");
                gap();
                line("...to me. I got the report. I'm flattered.", "warm");
                line('<a href="mailto:ca0977@princeton.edu">ca0977@princeton.edu</a>', "dim");
                return;
            }
            if (rest.startsWith("rm")) {
                line("Nice try.", "err");
                line("It's a static site. There's nothing here but HTML and ambition.", "dim");
                return;
            }
            line("calvin is not in the sudoers file. This incident has been reported.", "err");
        },

        secrets() {
            line("eggs", "head");
            gap();
            EGGS.forEach(([key, hint]) => {
                const got = hasFound(key);
                line("  " + (got ? '<span class="ok">[x]</span> ' : '<span class="dim">[ ]</span> ') +
                     (got ? '<span class="dim">' + hint + "</span>" : '<span class="dim">???</span>'));
            });
            gap();
            const total = EGGS.filter(([k]) => hasFound(k)).length;
            line(total + " / " + EGGS.length + " found", total === EGGS.length ? "ok" : "dim");
            if (total === EGGS.length) line("That's all of them. Genuinely, thank you for looking.", "warm");
        },

        play() { tttStart(); },
        ttt()  { tttStart(); },

        theme() {
            const root = document.documentElement;
            const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
            root.setAttribute("data-theme", next);
            try { localStorage.setItem("theme", next); } catch (e) {}
            line("theme → " + next, "ok");
        },

        clear() { term.out.innerHTML = ""; },

        exit() { close(); },
        q()    { close(); },

        ls() {
            line("about.html   experience.html   projects.html   index.html", "dim");
            line("secrets/     .well-hidden", "dim");
        },
        pwd()  { line("/home/calvin/portfolio", "dim"); },
        cat(args) {
            if (!args.length) { line("usage: cat &lt;file&gt;", "dim"); return; }
            line("cat: " + escapeHtml(args[0]) + ": Permission denied", "err");
            line('try <span class="warm">whoami</span> instead', "dim");
        },
        date() { line(new Date().toString(), "dim"); }
    };

    /* =====================================================
       Tic-tac-toe · minimax, unbeatable
       You are X and move first. Best case is a draw.
       ===================================================== */
    const WINS = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    function tttStart() {
        term.mode = "ttt";
        term.game = { board: Array(9).fill(null), over: false };
        found("ttt");
        line("tic-tac-toe", "head");
        line("You're X and you move first. I'm O. Pick a square by number.", "dim");
        line('<span class="dim">"q" to quit.</span>');
        gap();
        tttDraw();
        tttPrompt();
    }

    function tttDraw() {
        const b = term.game.board;
        const cell = (i) => {
            if (b[i] === "X") return '<span class="warm">X</span>';
            if (b[i] === "O") return '<span class="accent">O</span>';
            return '<span class="dim">' + (i + 1) + "</span>";
        };
        for (let r = 0; r < 3; r++) {
            const i = r * 3;
            line("   " + cell(i) + " │ " + cell(i + 1) + " │ " + cell(i + 2));
            if (r < 2) line('   <span class="dim">──┼───┼──</span>');
        }
        gap();
    }

    function tttPrompt() { line("your move (1-9):", "dim"); }

    function tttInput(value) {
        const v = value.trim().toLowerCase();
        if (v === "q" || v === "quit" || v === "exit") {
            term.mode = "shell";
            term.game = null;
            line("game over. back to the shell.", "dim");
            gap();
            return;
        }
        if (term.game.over) { tttStart(); return; }

        const spot = parseInt(v, 10) - 1;
        const b = term.game.board;
        if (isNaN(spot) || spot < 0 || spot > 8) { line("pick a number 1-9 (or q to quit)", "err"); return; }
        if (b[spot]) { line("that square is taken", "err"); return; }

        b[spot] = "X";
        gap();

        // Only let me answer if your move didn't already end it.
        let result = outcome(b);
        if (!result) {
            const move = bestMove(b);
            if (move !== -1) b[move] = "O";
            line("I played " + (move + 1) + ".", "dim");
            result = outcome(b);
        }

        tttDraw();
        if (result) { tttOver(result); } else { tttPrompt(); }
    }

    function outcome(b) {
        const w = winner(b);
        if (w) return w;
        return b.every(Boolean) ? "draw" : null;
    }

    function tttOver(result) {
        term.game.over = true;
        if (result === "X") {
            line("You won. That should not be possible — please email me how.", "ok");
        } else if (result === "O") {
            line("I win.", "accent");
        } else {
            line("Draw. That's the best anyone gets — minimax doesn't lose.", "warm");
        }
        gap();
        line('<span class="dim">enter to play again, or "q" for the shell</span>');
    }

    function winner(b) {
        for (const [a, c, d] of WINS) {
            if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
        }
        return null;
    }

    function bestMove(board) {
        let bestScore = -Infinity, move = -1;
        for (let i = 0; i < 9; i++) {
            if (board[i]) continue;
            board[i] = "O";
            const score = minimax(board, 0, false);
            board[i] = null;
            if (score > bestScore) { bestScore = score; move = i; }
        }
        return move;
    }

    function minimax(board, depth, maximizing) {
        const w = winner(board);
        if (w === "O") return 10 - depth;
        if (w === "X") return depth - 10;
        if (board.every(Boolean)) return 0;

        let best = maximizing ? -Infinity : Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i]) continue;
            board[i] = maximizing ? "O" : "X";
            const score = minimax(board, depth + 1, !maximizing);
            board[i] = null;
            best = maximizing ? Math.max(best, score) : Math.min(best, score);
        }
        return best;
    }

    /* =====================================================
       Triggers
       ===================================================== */
    const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
                    "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let konamiAt = 0;
    let typed = "";

    function isTyping(target) {
        if (!target) return false;
        const tag = target.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    }

    document.addEventListener("keydown", (e) => {
        if (term.open) {
            if (e.key === "Escape") close();
            return;
        }
        if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

        // Konami
        const expected = KONAMI[konamiAt];
        if (e.key === expected || e.key.toLowerCase() === expected) {
            konamiAt++;
            if (konamiAt === KONAMI.length) {
                konamiAt = 0;
                found("konami");
                confetti();
                openTerm();
                line("↑ ↑ ↓ ↓ ← → ← → B A", "warm");
                line("Respect. That one's older than both of us.", "dim");
                gap();
                return;
            }
        } else {
            konamiAt = e.key === KONAMI[0] ? 1 : 0;
        }

        // Backtick
        if (e.key === "`") { e.preventDefault(); openTerm(); return; }

        // Typing the name
        if (/^[a-z]$/i.test(e.key)) {
            typed = (typed + e.key.toLowerCase()).slice(-6);
            if (typed === "calvin") { typed = ""; openTerm(); }
        } else {
            typed = "";
        }
    });

    /* ---------- Ghana flag (about page) ---------- */
    (function () {
        const flag = document.querySelector(".flag-gh");
        if (!flag) return;
        flag.classList.add("egg-clickable");
        flag.setAttribute("role", "button");
        flag.setAttribute("tabindex", "0");
        let clicks = 0;
        const fire = (e) => {
            clicks++;
            const box = flag.getBoundingClientRect();
            confetti(box.left + box.width / 2, box.top + box.height / 2);
            if (clicks >= 3) {
                clicks = 0;
                found("flag");
                openTerm();
                COMMANDS.ghana();
                gap();
            }
        };
        flag.addEventListener("click", fire);
        flag.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(e); } });
    })();

    /* ---------- Boba counter (about page) ---------- */
    (function () {
        const boba = Array.from(document.querySelectorAll(".interest"))
            .find((el) => el.textContent.includes("🧋"));
        if (!boba) return;
        boba.classList.add("egg-clickable");

        const CAPTIONS = [
            "boba #1 — a journey begins",
            "boba #2 — pearls at the bottom, always",
            "boba #3 — this is fine",
            "boba #5 — the debugging fuel",
            "boba #10 — genuinely concerning",
            "boba #20 — I'm going to have to expense this",
            "boba #42 — the answer to everything"
        ];

        boba.addEventListener("click", (e) => {
            const count = load(BOBA, 0) + 1;
            save(BOBA, count);
            found("boba");

            const pop = document.createElement("div");
            pop.className = "egg-boba-pop";
            const caption = CAPTIONS.find((c) => c.startsWith("boba #" + count)) ||
                            "boba #" + count + " — 🧋";
            pop.textContent = caption;
            pop.style.left = e.clientX + "px";
            pop.style.top = e.clientY + "px";
            document.body.appendChild(pop);
            setTimeout(() => pop.remove(), 1600);
        });
    })();

    /* =====================================================
       Footer scoreboard
       Announces that eggs exist, and how many — never where.
       One click spends the only hint on offer.
       ===================================================== */
    let scoreEl = null;

    function refreshScore() {
        if (!scoreEl) return;
        const total = foundCount();
        const done = total === EGGS.length;
        scoreEl.querySelector(".egg-score-caret").textContent = done ? "★" : "▌";
        scoreEl.querySelector(".egg-score-text").textContent =
            done ? EGGS.length + " / " + EGGS.length + " — all found"
                 : total + " / " + EGGS.length + " found";
        scoreEl.classList.toggle("complete", done);
    }

    (function () {
        const footer = document.querySelector(".footer-inner");
        if (!footer) return;

        const wrap = document.createElement("div");
        wrap.className = "egg-score";
        wrap.innerHTML =
            '<button type="button" class="egg-score-btn">' +
                '<span class="egg-score-caret" aria-hidden="true">▌</span>' +
                '<span class="egg-score-text">0 / 0 found</span>' +
            "</button>" +
            '<span class="egg-score-hint" role="status"></span>';

        // Sits between the copyright and the socials.
        footer.insertBefore(wrap, footer.querySelector(".footer-socials"));
        scoreEl = wrap;

        const btn = wrap.querySelector(".egg-score-btn");
        const hintEl = wrap.querySelector(".egg-score-hint");
        btn.setAttribute("aria-label", "Easter eggs found on this site");

        btn.addEventListener("click", () => {
            if (foundCount() === EGGS.length) {
                hintEl.textContent = "nothing left to find. thank you for looking.";
            } else {
                hintEl.textContent = "this site listens to the keyboard";
            }
            hintEl.classList.add("show");
        });

        refreshScore();
    })();

    /* =====================================================
       Hero whisper (homepage only)
       Types a comment under the hero line, holds it, then
       takes it back — so it reads as something you caught
       rather than something you were told.
       ===================================================== */
    (function () {
        const typed = document.getElementById("typed");
        if (!typed) return;                        // homepage only
        if (foundCount() === EGGS.length) return;  // don't nag someone who's done

        const TEXT = "// ps. this site has five secrets";

        const el = document.createElement("div");
        el.className = "egg-whisper";
        // The footer counter carries this same information permanently and
        // accessibly, so the self-erasing copy stays out of the a11y tree.
        el.setAttribute("aria-hidden", "true");
        typed.insertAdjacentElement("afterend", el);

        if (reduceMotion) { el.textContent = TEXT; return; }

        // Hero TypeIt finishes around 2.3s; start well clear of it.
        const START = 4000, TYPE = 55, HOLD = 3800, ERASE = 22;
        let i = 0;

        function typeIn() {
            el.textContent = TEXT.slice(0, ++i);
            if (i < TEXT.length) setTimeout(typeIn, TYPE);
            else setTimeout(eraseOut, HOLD);
        }
        function eraseOut() {
            el.textContent = TEXT.slice(0, --i);
            if (i > 0) setTimeout(eraseOut, ERASE);
        }

        setTimeout(typeIn, START);
    })();

    /* ---------- Console banner ---------- */
    (function () {
        const brand = "color:#f2711c;font-weight:700;font-size:13px;line-height:1.35;font-family:ui-monospace,Menlo,monospace";
        const body = "color:#6c655d;font-size:12px;line-height:1.6;font-family:ui-monospace,Menlo,monospace";
        const hint = "color:#f5a623;font-size:12px;font-weight:600;font-family:ui-monospace,Menlo,monospace";

        console.log(
            "%c  ____      _       _       \n / ___|__ _| |_   _(_)_ __  \n" +
            "| |   / _` | \\ \\ / / | '_ \\ \n| |__| (_| | |\\ V /| | | | |\n" +
            " \\____\\__,_|_| \\_/ |_|_| |_|\n",
            brand
        );
        console.log("%cYou opened the console. We're going to get along.", body);
        console.log("%cSource: https://github.com/cfandoh123/Portfolio", body);
        console.log("%cPsst — press ` on any page. Or just type my name.", hint);
    })();

    /* ---------- Public hook (used by 404.html) ---------- */
    window.calvinEggs = { open: openTerm, run: (cmd) => submit(cmd), confetti: confetti };
})();
