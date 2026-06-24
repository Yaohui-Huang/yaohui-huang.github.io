(function () {
    const root = document.documentElement;
    root.classList.add("js");

    let revealObserver = null;
    const dataCache = new Map();

    function ready(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback);
            return;
        }
        callback();
    }

    ready(function initSite() {
        setupThemeToggle();
        setupScrollProgress();
        setupSectionNav();
        setupRevealObserver();
        loadContentSections();
        hardenExternalLinks(document);
    });

    function setupThemeToggle() {
        const button = document.querySelector(".theme-toggle");
        const icon = button ? button.querySelector("i") : null;
        const storageKey = "yh-site-theme";

        function storedTheme() {
            try {
                return localStorage.getItem(storageKey);
            } catch (error) {
                return null;
            }
        }

        function saveTheme(theme) {
            try {
                localStorage.setItem(storageKey, theme);
            } catch (error) {
                // Local storage can be unavailable in private contexts.
            }
        }

        function applyTheme(theme) {
            const isDark = theme === "dark";
            document.body.classList.toggle("theme-dark", isDark);
            if (button) {
                button.setAttribute("aria-pressed", String(isDark));
            }
            if (icon) {
                icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
            }
        }

        let theme = storedTheme() || "light";
        applyTheme(theme);

        if (!button) {
            return;
        }

        button.addEventListener("click", function () {
            theme = document.body.classList.contains("theme-dark") ? "light" : "dark";
            applyTheme(theme);
            saveTheme(theme);
        });
    }

    function setupScrollProgress() {
        const progress = document.querySelector(".scroll-progress span");
        const backToTop = document.querySelector(".back-to-top");

        function updateScrollState() {
            const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            const amount = Math.min(1, Math.max(0, window.scrollY / max));

            if (progress) {
                progress.style.transform = `scaleX(${amount})`;
            }

            if (backToTop) {
                backToTop.classList.toggle("is-visible", window.scrollY > 520);
            }
        }

        updateScrollState();
        window.addEventListener("scroll", updateScrollState, { passive: true });
        window.addEventListener("resize", updateScrollState);

        if (backToTop) {
            backToTop.addEventListener("click", function () {
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        }
    }

    function setupSectionNav() {
        const links = Array.from(document.querySelectorAll(".section-nav a[href^='#']"));
        if (!links.length) {
            return;
        }

        const linkById = new Map(links.map((link) => [link.getAttribute("href").slice(1), link]));

        function setActive(id) {
            links.forEach((link) => {
                link.classList.toggle("is-active", linkById.get(id) === link);
            });
        }

        const sections = Array.from(document.querySelectorAll("[data-section][id]")).filter((section) => linkById.has(section.id));
        if (!sections.length) {
            return;
        }

        let ticking = false;
        let lockedTargetId = null;

        function updateActiveSection() {
            ticking = false;

            if (lockedTargetId && linkById.has(lockedTargetId)) {
                setActive(lockedTargetId);
                return;
            }

            const documentHeight = document.documentElement.scrollHeight;
            const viewportBottom = window.scrollY + window.innerHeight;
            const atTop = window.scrollY <= 80;
            const atBottom = viewportBottom >= documentHeight - 4;
            const lastSection = sections[sections.length - 1];

            if (atTop) {
                setActive(sections[0].id);
                return;
            }

            if (atBottom) {
                const bottomActive = sections.slice().reverse().find((section) => {
                    return section.getBoundingClientRect().top <= window.innerHeight * 0.48;
                }) || lastSection;
                setActive(bottomActive.id);
                return;
            }

            const marker = window.scrollY + window.innerHeight * 0.34;
            let active = sections[0];

            sections.forEach((section) => {
                if (section.offsetTop <= marker) {
                    active = section;
                }
            });

            setActive(active.id);
        }

        function requestUpdate() {
            if (ticking) {
                return;
            }
            ticking = true;
            window.requestAnimationFrame(updateActiveSection);
        }

        updateActiveSection();
        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate);
        window.addEventListener("site:sections-loaded", requestUpdate);
        window.addEventListener("hashchange", function () {
            scrollToHashTarget();
            requestUpdate();
        });

        links.forEach((link) => {
            link.addEventListener("click", function (event) {
                const id = link.getAttribute("href").slice(1);
                const target = document.getElementById(id);
                if (!target) {
                    return;
                }

                event.preventDefault();
                history.pushState(null, "", `#${id}`);
                lockedTargetId = id;
                setActive(id);
                scrollToElement(target, "smooth");
                window.setTimeout(() => {
                    lockedTargetId = null;
                    requestUpdate();
                }, 1250);
            });
        });
    }

    function setupRevealObserver() {
        const initialTargets = document.querySelectorAll(".page-section");

        if (!("IntersectionObserver" in window)) {
            initialTargets.forEach((target) => target.classList.add("is-visible"));
            return;
        }

        revealObserver = new IntersectionObserver(
            function (entries, observer) {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
        );

        initialTargets.forEach((target) => revealObserver.observe(target));
    }

    function revealDynamicContent(container) {
        const targets = container.querySelectorAll(".publication-item, .news-list li, .projects-list li, .academic-service li");
        targets.forEach((target, index) => {
            target.style.setProperty("--reveal-delay", `${Math.min(index * 35, 280)}ms`);
            if (revealObserver) {
                revealObserver.observe(target);
            } else {
                target.classList.add("is-visible");
            }
        });
    }

    function loadContentSections() {
        const loaders = [
            {
                containerId: "publications-container",
                url: "data/publications.json",
                render: renderHomepagePublications
            },
            {
                containerId: "publication-archive-container",
                url: "data/publications.json",
                render: renderPublicationArchive
            },
            {
                containerId: "news-container",
                url: "data/news.json",
                render: renderNews
            },
            {
                containerId: "projects-container",
                url: "data/projects.json",
                render: renderProjects
            },
            {
                containerId: "service-container",
                url: "data/service.json",
                render: renderService
            }
        ].map(loadContentSection);

        Promise.all(loaders).then(() => {
            scrollToHashTarget();
            window.setTimeout(scrollToHashTarget, 180);
            window.dispatchEvent(new Event("site:sections-loaded"));
        });
    }

    async function loadContentSection(config) {
        const container = document.getElementById(config.containerId);
        if (!container) {
            return;
        }

        try {
            const data = await fetchJson(config.url);
            config.render(container, data);
            markContainerLoaded(container);
            revealDynamicContent(container);
        } catch (error) {
            container.className = "section-error";
            container.textContent = "Content could not be loaded. Please preview this page through a local server or GitHub Pages.";
            console.error(error);
        }
    }

    async function fetchJson(url) {
        if (!dataCache.has(url)) {
            dataCache.set(url, fetch(url, { cache: "no-store" }).then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${url}`);
                }
                return response.json();
            }));
        }

        return dataCache.get(url);
    }

    function markContainerLoaded(container) {
        container.classList.remove("section-loading");
        container.closest(".page-section")?.classList.add("is-loaded");
        hardenExternalLinks(container);
    }

    function renderHomepagePublications(container, data) {
        const publications = normalizePublications(data).filter((publication) => publication.selected !== false);
        renderPublicationCards(container, publications);
    }

    function renderPublicationArchive(container, data) {
        const publications = normalizePublications(data);

        const grouped = publications.reduce((map, publication) => {
            const year = getPublicationDataYear(publication);
            if (!map.has(year)) {
                map.set(year, []);
            }
            map.get(year).push(publication);
            return map;
        }, new Map());

        const years = Array.from(grouped.keys()).sort((a, b) => {
            if (a === "Other") return 1;
            if (b === "Other") return -1;
            return Number(b) - Number(a);
        });

        const nav = document.createElement("div");
        nav.className = "year-jump";
        nav.setAttribute("aria-label", "Jump to publication year");

        years.forEach((year) => {
            const link = document.createElement("a");
            link.href = `#publications-${year}`;
            link.textContent = year;
            nav.append(link);
        });

        const fragment = document.createDocumentFragment();
        fragment.append(nav);

        years.forEach((year) => {
            const block = document.createElement("section");
            block.className = "publication-year-block";
            block.id = `publications-${year}`;

            const heading = document.createElement("h2");
            heading.textContent = year;

            const count = document.createElement("span");
            count.className = "year-count";
            count.textContent = `${grouped.get(year).length} publication${grouped.get(year).length > 1 ? "s" : ""}`;
            heading.append(count);

            const list = document.createElement("div");
            list.className = "publication-year-list";

            grouped.get(year).forEach((publication, index) => {
                const panelId = getBibtexPanelId(publication, `${year}-${index}`);
                const item = createPublicationItem(publication, panelId);
                list.append(item);
            });

            block.append(heading, list);
            fragment.append(block);
        });

        container.replaceChildren(fragment);
    }

    function renderPublicationCards(container, publications) {
        const fragment = document.createDocumentFragment();

        publications.forEach((publication, index) => {
            const panelId = getBibtexPanelId(publication, index);
            const item = createPublicationItem(publication, panelId);
            fragment.append(item);
        });

        container.replaceChildren(fragment);
    }

    function createPublicationItem(publication, panelId) {
        const item = document.createElement("div");
        item.className = "publication-item";
        item.dataset.year = getPublicationDataYear(publication);

        const imageBox = document.createElement("div");
        imageBox.className = "pub-image";

        const image = document.createElement("img");
        image.className = "pub-img";
        image.src = publication.image || "./images/load.gif";
        image.alt = stripHtml(publication.titleHtml || publication.title || "Publication image");
        image.loading = "lazy";
        image.decoding = "async";
        image.onerror = function () {
            this.src = "./images/load.gif";
        };
        if (publication.imageZoom) {
            image.style.setProperty("--pub-image-zoom", publication.imageZoom);
        }
        if (publication.imagePosition) {
            image.style.objectPosition = publication.imagePosition;
        }
        imageBox.append(image);

        const content = document.createElement("div");
        content.className = "pub-content";
        content.dataset.structured = "true";

        const title = document.createElement("p");
        title.className = "pub-title";
        title.innerHTML = `<b>${publication.titleHtml || escapeHtml(publication.title || "")}</b>`;

        const tags = document.createElement("div");
        tags.className = "tags";
        toArray(publication.tags).forEach((tag) => {
            const span = document.createElement("span");
            span.className = "tag";
            span.textContent = tag;
            tags.append(span);
        });

        const authors = document.createElement("p");
        authors.className = "pub-authors";
        authors.innerHTML = publication.authorsHtml || escapeHtml(toArray(publication.authors).join(" and "));

        const footer = document.createElement("div");
        footer.className = "pub-card-footer";

        const meta = document.createElement("div");
        meta.className = "pub-meta";

        const venue = createPublicationVenue(publication);
        if (venue) {
            meta.append(venue);
        }

        if (publication.award) {
            const award = document.createElement("p");
            award.className = "pub-highlight";
            const bold = document.createElement("b");
            bold.textContent = `(${publication.award})`;
            award.append(bold);
            meta.append(award);
        }

        if (meta.childNodes.length) {
            footer.append(meta);
        }

        const actions = createPublicationActions(publication, panelId);
        if (actions) {
            footer.append(actions);
        }

        [title, tags, authors, footer].forEach((node) => {
            if (node && (node !== tags || node.childNodes.length)) {
                content.append(node);
            }
        });

        const bibtexPanel = createBibtexPanel(publication, panelId);
        if (bibtexPanel) {
            content.append(bibtexPanel);
        }

        item.append(imageBox, content);
        return item;
    }

    function createPublicationVenue(publication) {
        if (!publication.venue && !publication.year && !toArray(publication.badges).length) {
            return null;
        }

        const venue = document.createElement("p");
        venue.className = "pub-venue";

        if (publication.venue) {
            const italic = document.createElement("i");
            italic.textContent = publication.venue;
            venue.append(italic);
        }

        if (publication.year) {
            venue.append(document.createTextNode(`${publication.venue ? ", " : ""}${publication.year} `));
        }

        toArray(publication.badges).forEach((badge) => {
            const badgeNode = document.createElement("span");
            badgeNode.className = `badge ${badge.type || ""}`.trim();
            badgeNode.textContent = badge.label || badge;
            venue.append(badgeNode, document.createTextNode(" "));
        });

        return venue;
    }

    function createPublicationActions(publication, panelId) {
        const links = { ...(publication.links || {}) };
        if (!links.arxiv && (publication.arxiv || publication.arxivUrl)) {
            links.arxiv = publication.arxiv || publication.arxivUrl;
        }
        const entries = [];
        const preferredOrder = ["paper", "arxiv", "code", "project", "slides", "data", "video", "poster"];

        preferredOrder.forEach((key) => {
            if (links[key]) {
                entries.push([key, links[key]]);
            }
        });

        Object.keys(links).forEach((key) => {
            if (!preferredOrder.includes(key) && links[key]) {
                entries.push([key, links[key]]);
            }
        });

        if (!entries.length && !publication.bibtex) {
            return null;
        }

        const actions = document.createElement("div");
        actions.className = "pub-actions";

        entries.forEach(([key, href]) => {
            const link = document.createElement("a");
            link.className = "btn-link";
            link.href = href;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = actionLabel(key);
            actions.append(link);
        });

        if (publication.bibtex) {
            const button = document.createElement("button");
            button.className = "btn-link bibtex-toggle";
            button.type = "button";
            button.textContent = "BibTeX";
            button.setAttribute("aria-controls", panelId);
            button.setAttribute("aria-expanded", "false");
            button.addEventListener("click", () => window.toggleBibtexPanel(panelId, button));
            actions.append(button);
        }

        return actions;
    }

    function createBibtexPanel(publication, panelId) {
        if (!publication.bibtex) {
            return null;
        }

        const panel = document.createElement("div");
        panel.id = panelId;
        panel.className = "bibtex-panel";
        panel.hidden = true;

        const header = document.createElement("div");
        header.className = "bibtex-panel-header";

        const title = document.createElement("div");
        title.className = "bibtex-panel-title";
        title.textContent = "BibTeX";

        const copy = document.createElement("button");
        copy.className = "btn btn-copy";
        copy.type = "button";
        copy.textContent = "Copy";
        copy.addEventListener("click", () => window.copyBibtex(panelId));
        header.append(title, copy);

        const pre = document.createElement("pre");
        pre.className = "bibtex-box";

        const code = document.createElement("code");
        code.textContent = publication.bibtex;
        pre.append(code);

        panel.append(header, pre);
        return panel;
    }

    function normalizePublications(data) {
        return toArray(data.items || data).slice().sort((a, b) => {
            return Number(b.year || 0) - Number(a.year || 0);
        });
    }

    function preparePublicationItems(items) {
        items.forEach((item) => {
            item.dataset.year = getPublicationYear(item);
            structurePublicationItem(item);
            item.querySelectorAll("img").forEach((image) => {
                image.loading = "lazy";
                image.decoding = "async";
            });
        });
    }

    function structurePublicationItem(item) {
        const content = item.querySelector(".pub-content");
        if (!content || content.dataset.structured === "true") {
            return;
        }

        const title = content.querySelector(".pub-title");
        const authors = content.querySelector(".pub-authors");
        const tags = content.querySelector(".tags");
        const award = Array.from(content.children).find((node) => node.classList && node.classList.contains("pub-award"));
        const actions = content.querySelector(".pub-actions");
        const paragraphs = Array.from(content.children).filter((node) => node.tagName === "P").filter((paragraph) => {
            return paragraph !== title && paragraph !== authors && paragraph !== award;
        });
        const venue = paragraphs.find((paragraph) => paragraph.querySelector("i") || paragraph.querySelector(".badge"));
        const details = paragraphs.filter((paragraph) => paragraph !== venue);

        if (venue) {
            venue.classList.add("pub-venue");
        }

        const footer = document.createElement("div");
        footer.className = "pub-card-footer";

        const meta = document.createElement("div");
        meta.className = "pub-meta";

        if (venue) {
            meta.append(venue);
        }

        if (award && award.textContent.trim()) {
            award.classList.add("pub-highlight");
            meta.append(award);
        } else if (award) {
            award.remove();
        }

        if (meta.childNodes.length) {
            footer.append(meta);
        }

        if (actions) {
            footer.append(actions);
        }

        content.replaceChildren();
        [title, tags, authors, ...details, footer].forEach((node) => {
            if (node) {
                content.append(node);
            }
        });

        content.dataset.structured = "true";
    }

    function getPublicationYear(item) {
        const text = item.querySelector(".pub-content")?.textContent || item.textContent || "";
        return (text.match(/\b(19|20)\d{2}\b/) || [])[0] || "Other";
    }

    function getPublicationDataYear(publication) {
        return publication.year || (String(publication.venue || publication.bibtex || "").match(/\b(19|20)\d{2}\b/) || [])[0] || "Other";
    }

    function getBibtexPanelId(publication, fallback) {
        return `bibtex-panel-${slugify(publication.id || publication.title || fallback)}`;
    }

    function renderNews(container, data) {
        const list = document.createElement("ul");
        list.className = "news-list";

        toArray(data.items || data).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).forEach((entry) => {
            const item = document.createElement("li");
            const date = document.createElement("span");
            date.className = "news-date";
            date.textContent = entry.date || "";
            item.append(date, document.createTextNode(" "));
            const text = document.createElement("span");
            text.innerHTML = entry.textHtml || escapeHtml(entry.text || "");
            item.append(text);
            list.append(item);
        });

        container.replaceChildren(list);
        enhanceNews(container);
    }

    function renderProjects(container, data) {
        const list = document.createElement("ul");
        list.className = "projects-list";

        toArray(data.items || data).forEach((project) => {
            const item = document.createElement("li");
            appendTextSpan(item, "project-level", project.level);
            appendTextSpan(item, "project-position", project.position);
            appendTextSpan(item, "project-label", project.label);
            if (project.during) {
                appendTextSpan(item, "project-during", `(${project.during})`);
            }

            const paragraph = document.createElement("p");
            appendTextSpan(paragraph, "project-content", project.content);
            item.append(paragraph);
            list.append(item);
        });

        container.replaceChildren(list);
    }

    function renderService(container, data) {
        const list = document.createElement("ul");

        if (toArray(data.conferenceReviewers).length) {
            const item = document.createElement("li");
            const label = document.createElement("b");
            label.textContent = "Conference reviewer:";
            item.append(label, document.createTextNode(` ${toArray(data.conferenceReviewers).join(", ")}`));
            list.append(item);
        }

        if (toArray(data.journalReviewers).length) {
            const item = document.createElement("li");
            const label = document.createElement("b");
            label.textContent = "Journal reviewer:";
            item.append(label, document.createTextNode(` ${toArray(data.journalReviewers).join(", ")}`));
            list.append(item);
        }

        container.replaceChildren(list);
    }

    function enhanceNews(container) {
        const items = Array.from(container.querySelectorAll(".news-list li"));
        const initialLimit = 6;

        if (items.length <= initialLimit) {
            return;
        }

        let expanded = false;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "inline-control";

        function updateNews() {
            items.forEach((item, index) => {
                item.hidden = !expanded && index >= initialLimit;
            });
            button.textContent = expanded ? "Show recent news" : "Show all news";
        }

        button.addEventListener("click", function () {
            expanded = !expanded;
            updateNews();
        });

        container.append(button);
        updateNews();
    }

    function appendTextSpan(parent, className, value) {
        if (!value) {
            return;
        }

        const span = document.createElement("span");
        span.className = className;
        span.textContent = value;
        parent.append(span, document.createTextNode(" "));
    }

    function actionLabel(key) {
        const labels = {
            paper: "Paper",
            arxiv: "arXiv",
            code: "Code",
            project: "Project",
            slides: "Slides",
            data: "Data",
            video: "Video",
            poster: "Poster"
        };
        return labels[key] || key.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function toArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function slugify(value) {
        return String(value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
    }

    function stripHtml(value) {
        const div = document.createElement("div");
        div.innerHTML = String(value || "");
        return div.textContent || div.innerText || "";
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function hardenExternalLinks(scope) {
        scope.querySelectorAll("a[target='_blank'], a[target=\"_blank\"]").forEach((link) => {
            link.rel = "noopener";
        });
    }

    function scrollToHashTarget() {
        if (!window.location.hash) {
            return;
        }

        const id = decodeURIComponent(window.location.hash.slice(1));
        const target = document.getElementById(id);
        if (target) {
            scrollToElement(target, "auto");
        }
    }

    function scrollToElement(target, behavior) {
        const top = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, top), behavior });
    }

    window.toggleBibtexPanel = function toggleBibtexPanel(id, button) {
        const panel = document.getElementById(id);
        if (!panel) {
            return;
        }

        const shouldOpen = panel.hidden;
        panel.hidden = !shouldOpen;
        panel.classList.toggle("is-open", shouldOpen);

        if (button) {
            button.setAttribute("aria-expanded", String(shouldOpen));
            button.textContent = shouldOpen ? "Hide BibTeX" : "BibTeX";
        }
    };

    window.copyBibtex = async function copyBibtex(id) {
        const panel = document.getElementById(id);
        const box = panel ? panel.querySelector(".bibtex-box") : null;
        const button = panel ? panel.querySelector(".btn-copy") : null;
        const text = box ? box.textContent.trim() : "";

        if (!text) {
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                copyTextFallback(text);
            }
            flashCopyButton(button);
        } catch (error) {
            copyTextFallback(text);
            flashCopyButton(button);
        }
    };

    function copyTextFallback(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.append(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
    }

    function flashCopyButton(button) {
        if (!button) {
            return;
        }

        const oldText = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(() => {
            button.textContent = oldText;
        }, 1200);
    }

    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") {
            return;
        }

        document.querySelectorAll(".bibtex-panel.is-open").forEach((panel) => {
            panel.hidden = true;
            panel.classList.remove("is-open");
            document.querySelector(`[aria-controls="${panel.id}"]`)?.setAttribute("aria-expanded", "false");
            const button = document.querySelector(`[aria-controls="${panel.id}"]`);
            if (button) {
                button.textContent = "BibTeX";
            }
        });
    });
})();
