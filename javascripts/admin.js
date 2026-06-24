(function () {
    const fileConfigs = {
        publications: {
            label: "Publications",
            url: "data/publications.json",
            fileName: "publications.json",
            collectionKey: "items",
            fields: [
                { path: "selected", label: "Selected on homepage", type: "checkbox", hint: "Turn this off to keep the paper only on the full publications page." },
                { path: "id", label: "ID", type: "text", hint: "Stable lowercase identifier, for example aaai2026-m2fmoe." },
                { path: "titleHtml", label: "Title", type: "textarea", rows: 3, hint: "HTML is allowed for small formatting, such as M<sup>2</sup>FMoE." },
                { path: "authorsHtml", label: "Authors", type: "textarea", rows: 3, hint: "Use <b>Yaohui Huang</b> to highlight your name; keep * and # markers here." },
                { path: "venue", label: "Journal or conference", type: "text", hint: "Use the full venue name or short conference name shown below the card." },
                { path: "year", label: "Year", type: "number", hint: "Used for sorting and grouping on publications.html." },
                { path: "award", label: "Award or presentation", type: "text", hint: "Optional. Example: Oral Presentation or Best Paper Award." },
                { path: "image", label: "Image path", type: "text", hint: "Relative path, for example images/paper_images/example.png." },
                { path: "imageZoom", label: "Image zoom", type: "number", step: "0.01", hint: "1.00 keeps original crop; 1.06 slightly zooms to reduce white borders." },
                { path: "imagePosition", label: "Image position", type: "text", hint: "CSS object-position value, for example center, top, or 50% 40%." },
                { path: "links.paper", label: "Paper URL", type: "url", hint: "Official publisher, DOI, or proceedings page. This renders as Paper." },
                { path: "links.arxiv", label: "arXiv URL", type: "url", hint: "Optional preprint URL. This renders as a separate arXiv button." },
                { path: "links.code", label: "Code URL", type: "url", hint: "Optional GitHub or project repository URL." },
                { path: "tags", label: "Tags", type: "list", rows: 3, hint: "One per line, or comma-separated. Capitalization is kept exactly as written." },
                { path: "badges", label: "Badges", type: "badges", rows: 3, hint: "One per line as Label|type. Types can be jcr, ccf, or ei." },
                { path: "bibtex", label: "BibTeX", type: "textarea", rows: 11, code: true, hint: "Paste the full BibTeX entry. It will show in the inline BibTeX drawer." }
            ],
            createItem: function () {
                const year = new Date().getFullYear();
                return {
                    id: `publication-${year}`,
                    selected: true,
                    titleHtml: "New Publication",
                    authorsHtml: "<b>Yaohui Huang</b>",
                    venue: "",
                    year,
                    badges: [],
                    award: "",
                    image: "./images/load.gif",
                    imageZoom: 1.06,
                    imagePosition: "center",
                    links: { paper: "", arxiv: "", code: "" },
                    tags: [],
                    bibtex: ""
                };
            },
            summarize: function (item) {
                return `${item.year || "Year"} · ${stripHtml(item.titleHtml || item.title || "Untitled publication")}`;
            }
        },
        news: {
            label: "News",
            url: "data/news.json",
            fileName: "news.json",
            collectionKey: "items",
            fields: [
                { path: "date", label: "Date", type: "date", hint: "Use YYYY-MM-DD; newest items appear first." },
                { path: "textHtml", label: "News text", type: "textarea", rows: 6, hint: "HTML is allowed for links and bold text, for example <b>AAAI'26</b>." }
            ],
            createItem: function () {
                return {
                    date: new Date().toISOString().slice(0, 10),
                    textHtml: "[<b>News</b>] New update."
                };
            },
            summarize: function (item) {
                return `${item.date || "Date"} · ${stripHtml(item.textHtml || item.text || "Untitled news").slice(0, 80)}`;
            }
        },
        projects: {
            label: "Projects",
            url: "data/projects.json",
            fileName: "projects.json",
            collectionKey: "items",
            fields: [
                { path: "level", label: "Level", type: "text", hint: "Example: National, Provincial, School, or Industry." },
                { path: "position", label: "Position", type: "text", hint: "Example: Lead, Participant, or PI." },
                { path: "label", label: "Project name", type: "text", hint: "Funding source or project name shown in bold." },
                { path: "during", label: "Years", type: "text", hint: "Example: 2025-2027. Parentheses are added automatically." },
                { path: "content", label: "Description", type: "textarea", rows: 4, hint: "One concise sentence about the project or your responsibility." }
            ],
            createItem: function () {
                return {
                    level: "School",
                    position: "Lead",
                    label: "New Project",
                    during: "",
                    content: ""
                };
            },
            summarize: function (item) {
                return `${item.level || "Level"} · ${item.label || "Untitled project"}`;
            }
        },
        service: {
            label: "Service",
            url: "data/service.json",
            fileName: "service.json",
            singleton: true,
            fields: [
                { path: "conferenceReviewers", label: "Conference reviewers", type: "lines", rows: 5, hint: "One conference per line, for example AAAI'26." },
                { path: "journalReviewers", label: "Journal reviewers", type: "lines", rows: 12, hint: "One journal per line. The site joins them with commas." }
            ],
            createItem: function () {
                return {
                    conferenceReviewers: [],
                    journalReviewers: []
                };
            },
            summarize: function () {
                return "Academic Service";
            }
        }
    };

    const state = {
        activeKey: "publications",
        selectedIndex: 0,
        data: {},
        handles: {},
        dirty: false
    };

    const elements = {};

    document.addEventListener("DOMContentLoaded", initAdmin);

    async function initAdmin() {
        cacheElements();
        bindEvents();
        await loadAllData();
        selectTab("publications");
    }

    function cacheElements() {
        elements.tabs = Array.from(document.querySelectorAll("[data-admin-tab]"));
        elements.status = document.getElementById("admin-status");
        elements.listTitle = document.getElementById("admin-list-title");
        elements.list = document.getElementById("admin-list");
        elements.form = document.getElementById("admin-form");
        elements.openFile = document.getElementById("admin-open-file");
        elements.saveFile = document.getElementById("admin-save-file");
        elements.downloadFile = document.getElementById("admin-download-file");
        elements.newItem = document.getElementById("admin-new-item");
        elements.duplicateItem = document.getElementById("admin-duplicate-item");
        elements.deleteItem = document.getElementById("admin-delete-item");
        elements.moveUp = document.getElementById("admin-move-up");
        elements.moveDown = document.getElementById("admin-move-down");
    }

    function bindEvents() {
        elements.tabs.forEach((tab) => {
            tab.addEventListener("click", () => selectTab(tab.dataset.adminTab));
        });

        elements.openFile.addEventListener("click", openCurrentFile);
        elements.saveFile.addEventListener("click", saveCurrentFile);
        elements.downloadFile.addEventListener("click", downloadCurrentFile);
        elements.newItem.addEventListener("click", addItem);
        elements.duplicateItem.addEventListener("click", duplicateItem);
        elements.deleteItem.addEventListener("click", deleteItem);
        elements.moveUp.addEventListener("click", () => moveItem(-1));
        elements.moveDown.addEventListener("click", () => moveItem(1));

        elements.form.addEventListener("input", function () {
            syncFormToState();
            renderList();
            setDirty(true);
        });
    }

    async function loadAllData() {
        await Promise.all(Object.entries(fileConfigs).map(async ([key, config]) => {
            try {
                const response = await fetch(config.url, { cache: "no-store" });
                if (!response.ok) {
                    throw new Error(`Failed to load ${config.url}`);
                }
                state.data[key] = await response.json();
            } catch (error) {
                state.data[key] = config.singleton ? config.createItem() : { [config.collectionKey]: [] };
                setStatus(`Could not load ${config.fileName}; started with empty data.`, "warning");
            }
        }));
    }

    function selectTab(key) {
        if (!fileConfigs[key]) {
            return;
        }

        syncFormToState();
        state.activeKey = key;
        state.selectedIndex = 0;
        elements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.adminTab === key));
        renderWorkspace();
        setStatus(`Editing ${fileConfigs[key].fileName}.`, "neutral");
    }

    function renderWorkspace() {
        const config = activeConfig();
        elements.listTitle.textContent = config.label;
        const isSingleton = Boolean(config.singleton);
        [elements.newItem, elements.duplicateItem, elements.deleteItem, elements.moveUp, elements.moveDown].forEach((button) => {
            button.disabled = isSingleton;
        });
        renderList();
        renderForm();
    }

    function renderList() {
        const config = activeConfig();
        const items = currentItems();
        elements.list.replaceChildren();

        if (config.singleton) {
            const button = listButton(config.summarize(state.data[state.activeKey]), 0);
            elements.list.append(button);
            return;
        }

        if (!items.length) {
            const empty = document.createElement("p");
            empty.className = "admin-empty";
            empty.textContent = "No items yet.";
            elements.list.append(empty);
            return;
        }

        items.forEach((item, index) => {
            elements.list.append(listButton(config.summarize(item), index));
        });
    }

    function listButton(label, index) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "admin-list-item";
        button.classList.toggle("is-active", index === state.selectedIndex);
        button.textContent = label;
        button.addEventListener("click", function () {
            syncFormToState();
            state.selectedIndex = index;
            renderList();
            renderForm();
        });
        return button;
    }

    function renderForm() {
        const config = activeConfig();
        const item = currentItem();
        elements.form.replaceChildren();

        if (!item) {
            const empty = document.createElement("p");
            empty.className = "admin-empty";
            empty.textContent = "Create an item to edit.";
            elements.form.append(empty);
            return;
        }

        config.fields.forEach((field) => {
            elements.form.append(createField(field, item));
        });
    }

    function createField(field, item) {
        const wrapper = document.createElement("label");
        wrapper.className = `admin-field admin-field-${field.type}`;

        const label = document.createElement("span");
        label.className = "admin-field-label";
        label.textContent = field.label;
        wrapper.append(label);

        const value = getPath(item, field.path);
        let input;

        if (field.type === "textarea" || field.type === "list" || field.type === "badges" || field.type === "lines") {
            input = document.createElement("textarea");
            input.rows = field.rows || 4;
            input.value = formatFieldValue(field, value);
            if (field.code) {
                input.classList.add("code-input");
            }
        } else if (field.type === "checkbox") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = Boolean(value);
        } else {
            input = document.createElement("input");
            input.type = field.type || "text";
            input.value = value == null ? "" : value;
            if (field.step) {
                input.step = field.step;
            }
        }

        input.name = field.path;
        input.dataset.fieldType = field.type;
        if (field.placeholder) {
            input.placeholder = field.placeholder;
        }
        wrapper.append(input);
        if (field.hint) {
            const hint = document.createElement("small");
            hint.className = "admin-field-hint";
            hint.textContent = field.hint;
            wrapper.append(hint);
        }
        return wrapper;
    }

    function syncFormToState() {
        const item = currentItem();
        if (!item || !elements.form) {
            return;
        }

        const config = activeConfig();
        config.fields.forEach((field) => {
            const input = elements.form.elements[field.path];
            if (!input) {
                return;
            }
            setPath(item, field.path, parseFieldValue(field, input));
        });
    }

    function formatFieldValue(field, value) {
        if (field.type === "list" || field.type === "lines") {
            return Array.isArray(value) ? value.join("\n") : "";
        }

        if (field.type === "badges") {
            return Array.isArray(value) ? value.map((badge) => `${badge.label || badge}|${badge.type || ""}`).join("\n") : "";
        }

        return value == null ? "" : String(value);
    }

    function parseFieldValue(field, input) {
        if (field.type === "checkbox") {
            return input.checked;
        }

        if (field.type === "number") {
            return input.value === "" ? "" : Number(input.value);
        }

        if (field.type === "list" || field.type === "lines") {
            return input.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean);
        }

        if (field.type === "badges") {
            return input.value.split(/\n|,/).map((line) => line.trim()).filter(Boolean).map((line) => {
                const parts = line.split("|").map((part) => part.trim());
                return { label: parts[0], type: parts[1] || "" };
            });
        }

        return input.value;
    }

    function addItem() {
        const config = activeConfig();
        if (config.singleton) {
            return;
        }

        syncFormToState();
        const items = currentItems();
        items.unshift(config.createItem());
        state.selectedIndex = 0;
        setDirty(true);
        renderWorkspace();
    }

    function duplicateItem() {
        const config = activeConfig();
        if (config.singleton) {
            return;
        }

        syncFormToState();
        const items = currentItems();
        const item = currentItem();
        if (!item) {
            return;
        }

        items.splice(state.selectedIndex + 1, 0, JSON.parse(JSON.stringify(item)));
        state.selectedIndex += 1;
        setDirty(true);
        renderWorkspace();
    }

    function deleteItem() {
        const config = activeConfig();
        if (config.singleton) {
            return;
        }

        const items = currentItems();
        if (!items.length) {
            return;
        }

        items.splice(state.selectedIndex, 1);
        state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, items.length - 1));
        setDirty(true);
        renderWorkspace();
    }

    function moveItem(direction) {
        const config = activeConfig();
        if (config.singleton) {
            return;
        }

        syncFormToState();
        const items = currentItems();
        const target = state.selectedIndex + direction;
        if (target < 0 || target >= items.length) {
            return;
        }

        const item = items.splice(state.selectedIndex, 1)[0];
        items.splice(target, 0, item);
        state.selectedIndex = target;
        setDirty(true);
        renderWorkspace();
    }

    async function openCurrentFile() {
        const config = activeConfig();

        try {
            if (window.showOpenFilePicker) {
                const [handle] = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
                });
                const file = await handle.getFile();
                state.data[state.activeKey] = JSON.parse(await file.text());
                state.handles[state.activeKey] = handle;
            } else {
                state.data[state.activeKey] = await openWithInput();
            }

            state.selectedIndex = 0;
            setDirty(false);
            renderWorkspace();
            setStatus(`Opened ${config.fileName}.`, "success");
        } catch (error) {
            setStatus("Open cancelled or the file was not valid JSON.", "warning");
        }
    }

    function openWithInput() {
        return new Promise((resolve, reject) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json,application/json";
            input.addEventListener("change", async function () {
                const file = input.files && input.files[0];
                if (!file) {
                    reject(new Error("No file"));
                    return;
                }
                try {
                    resolve(JSON.parse(await file.text()));
                } catch (error) {
                    reject(error);
                }
            });
            input.click();
        });
    }

    async function saveCurrentFile() {
        syncFormToState();
        const config = activeConfig();
        const json = currentJsonText();

        try {
            let handle = state.handles[state.activeKey];
            if (!handle && window.showSaveFilePicker) {
                handle = await window.showSaveFilePicker({
                    suggestedName: config.fileName,
                    types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
                });
                state.handles[state.activeKey] = handle;
            }

            if (!handle) {
                downloadText(json, config.fileName);
                setStatus(`Downloaded ${config.fileName}.`, "success");
                return;
            }

            if (await verifyPermission(handle)) {
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                setDirty(false);
                setStatus(`Saved ${config.fileName}.`, "success");
            } else {
                downloadText(json, config.fileName);
                setStatus(`Permission denied; downloaded ${config.fileName} instead.`, "warning");
            }
        } catch (error) {
            setStatus("Save cancelled.", "warning");
        }
    }

    function downloadCurrentFile() {
        syncFormToState();
        const config = activeConfig();
        downloadText(currentJsonText(), config.fileName);
        setStatus(`Downloaded ${config.fileName}.`, "success");
    }

    async function verifyPermission(handle) {
        if (!handle.queryPermission || !handle.requestPermission) {
            return true;
        }

        const options = { mode: "readwrite" };
        if (await handle.queryPermission(options) === "granted") {
            return true;
        }

        return await handle.requestPermission(options) === "granted";
    }

    function currentJsonText() {
        return `${JSON.stringify(state.data[state.activeKey], null, 2)}\n`;
    }

    function downloadText(text, fileName) {
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function currentItems() {
        const config = activeConfig();
        if (config.singleton) {
            return [state.data[state.activeKey]];
        }

        if (!state.data[state.activeKey][config.collectionKey]) {
            state.data[state.activeKey][config.collectionKey] = [];
        }
        return state.data[state.activeKey][config.collectionKey];
    }

    function currentItem() {
        const config = activeConfig();
        if (config.singleton) {
            return state.data[state.activeKey];
        }
        return currentItems()[state.selectedIndex];
    }

    function activeConfig() {
        return fileConfigs[state.activeKey];
    }

    function setDirty(dirty) {
        state.dirty = dirty;
        if (dirty) {
            setStatus("Unsaved changes.", "warning");
        }
    }

    function setStatus(message, tone) {
        elements.status.textContent = message;
        elements.status.dataset.tone = tone || "neutral";
    }

    function getPath(object, path) {
        return path.split(".").reduce((value, key) => value && value[key], object);
    }

    function setPath(object, path, value) {
        const parts = path.split(".");
        let target = object;
        parts.slice(0, -1).forEach((part) => {
            if (!target[part] || typeof target[part] !== "object") {
                target[part] = {};
            }
            target = target[part];
        });
        target[parts[parts.length - 1]] = value;
    }

    function stripHtml(value) {
        const div = document.createElement("div");
        div.innerHTML = String(value || "");
        return div.textContent || div.innerText || "";
    }
})();
