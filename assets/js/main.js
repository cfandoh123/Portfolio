/* =========================================================
   Calvin Andoh — Portfolio shared scripts
   ========================================================= */

/* ---------- Theme toggle (persisted) ---------- */
(function () {
    const root = document.documentElement;
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
        const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch (e) {}
    });
})();

/* ---------- Mobile nav ---------- */
(function () {
    const btn = document.querySelector(".nav-toggle");
    const links = document.getElementById("nav-links");
    if (!btn || !links) return;
    btn.addEventListener("click", () => {
        const open = links.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach((a) =>
        a.addEventListener("click", () => links.classList.remove("open"))
    );
})();

/* ---------- Scroll reveal ---------- */
(function () {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
        items.forEach((el) => el.classList.add("in-view"));
        return;
    }
    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("in-view");
                    io.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el, i) => {
        // gentle stagger for siblings sharing a parent
        el.style.transitionDelay = Math.min((i % 6) * 60, 320) + "ms";
        io.observe(el);
    });
})();

/* ---------- Experience tabs ---------- */
(function () {
    const tabs = document.querySelectorAll("[data-tab]");
    if (!tabs.length) return;
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const target = tab.getAttribute("data-tab");
            tabs.forEach((t) => t.classList.toggle("active", t === tab));
            document.querySelectorAll("[data-panel]").forEach((panel) => {
                panel.classList.toggle("active", panel.getAttribute("data-panel") === target);
            });
        });
    });
})();

/* ---------- Footer year ---------- */
(function () {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
})();

/* ---------- Hero typing (home only; requires TypeIt) ---------- */
(function () {
    const el = document.getElementById("typed");
    if (!el || typeof TypeIt === "undefined") return;
    new TypeIt("#typed", { speed: 45, waitUntilVisible: true, cursorChar: "▌" })
        .type("const engineer = ")
        .pause(250)
        .type("'Calvin Andoh';")
        .pause(600)
        .go();
})();
