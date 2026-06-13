import {
    closeActionMenu,
    copyTextToClipboard,
    escapeHtml,
    getCsrfToken,
    openActionMenu,
    openModal,
    showInlineFlash
} from "../../core/app.js";
import { bindConditionTooltips, bindInternalPostLinkPreviews, bindVipTooltips } from "./shared.js";

var markdownTextColors = [
    { className: "md-color-berry", label: "Berry", color: "#d9487d" },
    { className: "md-color-rose", label: "Rose", color: "#f25f7a" },
    { className: "md-color-orange", label: "Orange", color: "#ef8f32" },
    { className: "md-color-gold", label: "Gold", color: "#c79512" },
    { className: "md-color-green", label: "Green", color: "#1f9d68" },
    { className: "md-color-cyan", label: "Cyan", color: "#1493a5" },
    { className: "md-color-blue", label: "Blue", color: "#3c72f6" },
    { className: "md-color-purple", label: "Purple", color: "#7a56f4" }
];
var markdownEmojis = ["😀", "😁", "😂", "😉", "😍", "🤔", "😎", "🥳", "👏", "🙌", "🔥", "✨", "🎉", "💡", "✅", "❗", "❤️", "👍", "👀", "🙏"];
var markdownPreviewCounter = 0;
var markdownPreviewRequestId = 0;
var markdownImageInput = null;
var activeImageEditor = null;
var markdownTableImportInput = null;
var activeTableImportEditor = null;
var activeTableImportDelimiter = ",";
var activeTableImportAccept = ".csv,text/csv";
var tablePicker = null;
var activeTableEditor = null;
var colorPicker = null;
var activeColorEditor = null;
var activeColorSelectionState = null;
var activeColorPickerMode = "toolbar";
var emojiPicker = null;
var activeEmojiEditor = null;
var activeEmojiSelectionState = null;
var activeEmojiPickerMode = "toolbar";
var activeReferenceEditor = null;
var toolbarHoverMenu = null;
var toolbarHoverMenuTimer = 0;
var tableContextMenu = null;
var tableContextMenuState = null;
var editorContextToolbar = null;
var activeContextToolbarEditor = null;
var editorContextSelectionState = null;
var markdownEditors = [];
var postMarkdownEditor = null;

export function getMarkdownEditors() {
    return markdownEditors;
}

export function getPrimaryPostMarkdownEditor() {
    return postMarkdownEditor;
}

function getEditorString(editor, attributeName, fallback) {
    if (!editor || !editor.element) {
        return fallback || "";
    }
    return editor.element.getAttribute(attributeName) || fallback || "";
}

function insertMarkdownLink(editor, displayName, url) {
    var label = (displayName || "").trim() || "Link";
    var href = (url || "").trim();
    if (!editor || !editor.codemirror || !href) {
        return;
    }
    editor.codemirror.replaceSelection("[" + label + "](" + href + ")");
    editor.codemirror.focus();
}

function insertMarkdownImage(editor, altText, url) {
    var label = (altText || "").trim() || "image";
    var href = (url || "").trim();
    if (!editor || !editor.codemirror || !href) {
        return;
    }
    editor.codemirror.replaceSelection("![" + label + "](" + href + ")");
    editor.codemirror.focus();
}

function isLooseBlockBoundary(previousLine, currentLine) {
    var previous = (previousLine || "").trim();
    var current = (currentLine || "").trim();

    if (!previous || !current) {
        return false;
    }
    if (/^<[^>]+>/.test(previous) || /^<[^>]+>/.test(current)) {
        return true;
    }
    if (/^(?:[*_]{1,3}|~~|`)/.test(previous) || /^(?:[*_]{1,3}|~~|`)/.test(current)) {
        return true;
    }
    if (/^\[[^\]]+\]\([^\)]+\)/.test(previous) || /^\[[^\]]+\]\([^\)]+\)/.test(current)) {
        return true;
    }
    return false;
}

function splitLooseMarkdownBlocks(text) {
    var lines = (text || "").split(/\r?\n/);
    var blocks = [];
    var currentBlock = [];

    function flushCurrentBlock() {
        if (!currentBlock.length) {
            return;
        }
        blocks.push(currentBlock.join("\n"));
        currentBlock = [];
    }

    lines.forEach(function (line, index) {
        var previousLine = index > 0 ? lines[index - 1] : "";
        if (!line.trim()) {
            flushCurrentBlock();
            return;
        }
        if (currentBlock.length && isLooseBlockBoundary(previousLine, line)) {
            flushCurrentBlock();
        }
        currentBlock.push(line);
    });

    flushCurrentBlock();
    return blocks;
}

function buildMarkdownTableFromGrid(rows) {
    var normalizedRows = (rows || []).filter(function (row) {
        return Array.isArray(row) && row.length;
    });
    if (!normalizedRows.length) {
        return "";
    }

    return [
        "| " + normalizedRows[0].join(" | ") + " |",
        "| " + normalizedRows[0].map(function () { return "---"; }).join(" | ") + " |"
    ].concat(normalizedRows.slice(1).map(function (row) {
        return "| " + row.join(" | ") + " |";
    })).join("\n");
}

function normalizeImportedTableRows(rows) {
    var normalizedRows = Array.isArray(rows) ? rows.slice() : [];
    var maxColumns = 0;

    while (normalizedRows.length && normalizedRows[normalizedRows.length - 1].every(function (cell) { return !String(cell || "").trim(); })) {
        normalizedRows.pop();
    }

    normalizedRows = normalizedRows.map(function (row) {
        return Array.isArray(row) ? row.map(function (cell) { return String(cell || ""); }) : [];
    }).filter(function (row) {
        return row.length;
    });

    normalizedRows.forEach(function (row) {
        maxColumns = Math.max(maxColumns, row.length);
    });

    if (!normalizedRows.length || !maxColumns) {
        return [];
    }

    return normalizedRows.map(function (row) {
        var normalizedRow = row.slice();
        while (normalizedRow.length < maxColumns) {
            normalizedRow.push("");
        }
        return normalizedRow;
    });
}

function parseDelimitedTable(text, delimiter) {
    var rows = [];
    var row = [];
    var cell = "";
    var index = 0;
    var source = String(text || "").replace(/^\uFEFF/, "");
    var inQuotes = false;

    for (index = 0; index < source.length; index += 1) {
        var character = source.charAt(index);
        var nextCharacter = source.charAt(index + 1);
        if (inQuotes) {
            if (character === '"') {
                if (nextCharacter === '"') {
                    cell += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += character;
            }
            continue;
        }
        if (character === '"') {
            inQuotes = true;
            continue;
        }
        if (character === delimiter) {
            row.push(cell);
            cell = "";
            continue;
        }
        if (character === "\r") {
            if (nextCharacter === "\n") {
                index += 1;
            }
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
            continue;
        }
        if (character === "\n") {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
            continue;
        }
        cell += character;
    }

    if (cell || row.length) {
        row.push(cell);
        rows.push(row);
    }

    return normalizeImportedTableRows(rows);
}

function openTableImportError(editor, fallbackMessage) {
    openModal({
        tone: "error",
        kicker: getEditorString(editor, "data-table-title", "Insert table"),
        title: getEditorString(editor, "data-table-import-error-title", "Table import failed"),
        message: fallbackMessage || getEditorString(editor, "data-table-import-error-message", "Please choose a valid CSV or TSV file and try again."),
        confirmText: "OK"
    });
}

function buildTableImportAction(editor, delimiter, labelAttribute, fallbackLabel, iconText, accept) {
    return {
        label: getEditorString(editor, labelAttribute, fallbackLabel),
        iconText: iconText,
        onClick: function () {
            openMarkdownTableImport(editor, delimiter, accept);
        }
    };
}

function createMenuIconNode(action, className) {
    var icon = null;
    if (action.iconText) {
        icon = document.createElement("span");
        icon.className = className + " editor-menu-text-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = action.iconText;
        return icon;
    }
    icon = document.createElement("i");
    icon.className = (action.iconClass || "fa-solid fa-circle") + " " + className;
    icon.setAttribute("aria-hidden", "true");
    return icon;
}

function createMenuSeparatorNode(className) {
    var separator = document.createElement("div");
    separator.className = className;
    separator.setAttribute("role", "separator");
    separator.setAttribute("aria-hidden", "true");
    return separator;
}

function clearToolbarHoverMenuTimer() {
    if (toolbarHoverMenuTimer) {
        window.clearTimeout(toolbarHoverMenuTimer);
        toolbarHoverMenuTimer = 0;
    }
}

function ensureToolbarHoverMenu() {
    if (toolbarHoverMenu) {
        return toolbarHoverMenu;
    }
    toolbarHoverMenu = document.createElement("div");
    toolbarHoverMenu.className = "editor-toolbar-hover-menu";
    toolbarHoverMenu.hidden = true;
    toolbarHoverMenu.addEventListener("mouseenter", clearToolbarHoverMenuTimer);
    toolbarHoverMenu.addEventListener("mouseleave", scheduleToolbarHoverMenuClose);
    document.body.appendChild(toolbarHoverMenu);
    return toolbarHoverMenu;
}

function closeToolbarHoverMenu() {
    clearToolbarHoverMenuTimer();
    if (!toolbarHoverMenu) {
        return;
    }
    toolbarHoverMenu.hidden = true;
    toolbarHoverMenu.innerHTML = "";
    toolbarHoverMenu.removeAttribute("data-toolbar-hover-owner");
    toolbarHoverMenu.classList.remove("is-vertical");
}

function ensureTableContextMenu() {
    if (tableContextMenu) {
        return tableContextMenu;
    }
    tableContextMenu = document.createElement("div");
    tableContextMenu.className = "editor-table-context-menu";
    tableContextMenu.hidden = true;
    document.body.appendChild(tableContextMenu);
    return tableContextMenu;
}

function closeTableContextMenu() {
    if (!tableContextMenu) {
        return;
    }
    tableContextMenu.hidden = true;
    tableContextMenu.innerHTML = "";
    tableContextMenuState = null;
}

function ensureEditorContextToolbar() {
    if (editorContextToolbar) {
        return editorContextToolbar;
    }
    editorContextToolbar = document.createElement("div");
    editorContextToolbar.className = "editor-context-toolbar";
    editorContextToolbar.hidden = true;
    document.body.appendChild(editorContextToolbar);
    return editorContextToolbar;
}

function closeEditorContextToolbar(preserveSelectionState) {
    if (!editorContextToolbar) {
        return;
    }
    editorContextToolbar.hidden = true;
    editorContextToolbar.innerHTML = "";
    if (!preserveSelectionState) {
        clearEditorContextSelection();
    }
}

function positionContextMenu(menu, event) {
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var spacing = 12;
    var left = event.clientX;
    var top = event.clientY;
    var menuWidth = menu.offsetWidth;
    var menuHeight = menu.offsetHeight;

    if (left + menuWidth + spacing > viewportWidth) {
        left = Math.max(spacing, viewportWidth - menuWidth - spacing);
    }
    if (top + menuHeight + spacing > viewportHeight) {
        top = Math.max(spacing, viewportHeight - menuHeight - spacing);
    }
    menu.style.left = left + "px";
    menu.style.top = top + "px";
}

function openTableContextMenu(event, actions, state) {
    var menu = ensureTableContextMenu();
    if (!menu || !actions || !actions.length) {
        return;
    }
    menu.innerHTML = "";
    tableContextMenuState = state || null;
    actions.forEach(function (action) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "editor-table-context-menu-item" + (action.isDanger ? " is-danger" : "");
        item.textContent = action.label || "";
        item.disabled = Boolean(action.disabled);
        item.addEventListener("click", function () {
            if (item.disabled) {
                return;
            }
            if (typeof action.onClick === "function") {
                action.onClick();
            }
            closeTableContextMenu();
        });
        menu.appendChild(item);
    });
    menu.hidden = false;
    positionContextMenu(menu, event);
}

function scheduleToolbarHoverMenuClose() {
    clearToolbarHoverMenuTimer();
    toolbarHoverMenuTimer = window.setTimeout(closeToolbarHoverMenu, 120);
}

function positionPicker(picker, anchorElement) {
    var buttonRect = null;
    if (!picker || !anchorElement) {
        return;
    }
    buttonRect = anchorElement.getBoundingClientRect();
    picker.hidden = false;
    picker.style.top = window.scrollY + buttonRect.bottom + 10 + "px";
    picker.style.left = window.scrollX + Math.max(12, buttonRect.left) + "px";
}

function positionPickerWithinViewport(picker, left, top) {
    var spacing = 12;
    var pickerWidth = 0;
    var pickerHeight = 0;
    var maxLeft = 0;
    var maxTop = 0;
    if (!picker) {
        return;
    }
    picker.hidden = false;
    pickerWidth = picker.offsetWidth;
    pickerHeight = picker.offsetHeight;
    maxLeft = window.scrollX + window.innerWidth - pickerWidth - spacing;
    maxTop = window.scrollY + window.innerHeight - pickerHeight - spacing;
    picker.style.left = Math.max(window.scrollX + spacing, Math.min(left, maxLeft)) + "px";
    picker.style.top = Math.max(window.scrollY + spacing, Math.min(top, maxTop)) + "px";
}

function positionPickerAtSelection(picker, editor, selectionState) {
    var coords = null;
    var wrapper = null;
    var wrapperRect = null;
    var selection = selectionState || captureEditorSelection(editor);
    if (!picker || !editor || !editor.codemirror) {
        return false;
    }
    if (typeof editor.codemirror.cursorCoords === "function") {
        coords = editor.codemirror.cursorCoords(selection && selection.to ? selection.to : editor.codemirror.getCursor("to"), "window");
    }
    if (coords && typeof coords.left === "number" && typeof coords.bottom === "number") {
        positionPickerWithinViewport(picker, window.scrollX + coords.left, window.scrollY + coords.bottom + 10);
        return true;
    }
    wrapper = typeof editor.codemirror.getWrapperElement === "function" ? editor.codemirror.getWrapperElement() : null;
    if (!wrapper) {
        return false;
    }
    wrapperRect = wrapper.getBoundingClientRect();
    positionPickerWithinViewport(picker, window.scrollX + wrapperRect.left + 16, window.scrollY + wrapperRect.top + 48);
    return true;
}

function isPickerButtonClick(eventTarget, editor, toolbarItemName) {
    var toolbarButton = editor && editor.toolbarElements ? editor.toolbarElements[toolbarItemName] : null;
    return Boolean(toolbarButton && (toolbarButton === eventTarget || toolbarButton.contains(eventTarget)));
}

function cloneCodeMirrorPosition(position) {
    if (!position) {
        return null;
    }
    return { line: position.line, ch: position.ch };
}

function captureEditorSelection(editor) {
    var doc = null;
    if (!editor || !editor.codemirror) {
        return null;
    }
    doc = editor.codemirror.getDoc();
    return {
        from: cloneCodeMirrorPosition(doc.getCursor("from")),
        to: cloneCodeMirrorPosition(doc.getCursor("to"))
    };
}

function cloneSelectionState(selectionState) {
    if (!selectionState || !selectionState.from || !selectionState.to) {
        return null;
    }
    return {
        from: cloneCodeMirrorPosition(selectionState.from),
        to: cloneCodeMirrorPosition(selectionState.to)
    };
}

function restoreEditorSelection(editor, selectionState) {
    var doc = null;
    if (!editor || !editor.codemirror || !selectionState || !selectionState.from || !selectionState.to) {
        return;
    }
    doc = editor.codemirror.getDoc();
    doc.setSelection(selectionState.from, selectionState.to);
    editor.codemirror.focus();
}

function restoreActiveContextEditorSelection(editor) {
    if (!editor || editor !== activeContextToolbarEditor || !editorContextSelectionState) {
        return;
    }
    restoreEditorSelection(editor, editorContextSelectionState);
}

function clearEditorContextSelection() {
    activeContextToolbarEditor = null;
    editorContextSelectionState = null;
}

function openToolbarHoverMenu(editor, toolbarItemName, actions) {
    var menu = ensureToolbarHoverMenu();
    var button = editor && editor.toolbarElements ? editor.toolbarElements[toolbarItemName] : null;
    var isVertical = toolbarItemName === "table-grid";
    if (!menu || !button || !actions || !actions.length) {
        return;
    }
    clearToolbarHoverMenuTimer();
    menu.innerHTML = "";
    menu.setAttribute("data-toolbar-hover-owner", toolbarItemName);
    menu.classList.toggle("is-vertical", isVertical);
    actions.forEach(function (action) {
        var item = document.createElement("button");
        var icon = createMenuIconNode(action, "editor-toolbar-hover-icon");
        var label = document.createElement("span");
        item.type = "button";
        item.className = "editor-toolbar-hover-action";
        item.setAttribute("title", action.label || "");
        item.setAttribute("aria-label", action.label || "");
        label.className = "sr-only";
        label.textContent = action.label || "";
        item.appendChild(icon);
        item.appendChild(label);
        item.addEventListener("click", function () {
            if (typeof action.onClick === "function") {
                action.onClick();
            }
            closeToolbarHoverMenu();
        });
        menu.appendChild(item);
    });
    positionPicker(menu, button);
}

function bindToolbarHoverMenu(editor, toolbarItemName, actions) {
    var button = editor && editor.toolbarElements ? editor.toolbarElements[toolbarItemName] : null;
    if (!button || !actions || !actions.length) {
        return;
    }
    button.addEventListener("mouseenter", function () {
        openToolbarHoverMenu(editor, toolbarItemName, actions);
    });
    button.addEventListener("mouseleave", scheduleToolbarHoverMenuClose);
    button.addEventListener("focus", function () {
        openToolbarHoverMenu(editor, toolbarItemName, actions);
    });
    button.addEventListener("blur", scheduleToolbarHoverMenuClose);
}

function openInternalReferenceDialog(editor) {
    var searchUrl = getEditorString(editor, "data-reference-search-url", "");
    var container = document.createElement("div");
    var input = document.createElement("input");
    var results = document.createElement("div");
    var resultsGrid = document.createElement("div");
    var pagination = document.createElement("div");
    var paginationStatus = document.createElement("div");
    var paginationActions = document.createElement("div");
    var previousButton = document.createElement("button");
    var nextButton = document.createElement("button");
    var emptyLabel = getEditorString(editor, "data-reference-empty-label", "No posts found.");
    var title = getEditorString(editor, "data-reference-title", "Reference internal post");
    var kicker = getEditorString(editor, "data-reference-kicker", "Posts");
    var cancelLabel = getEditorString(editor, "data-link-cancel-label", "Cancel");
    var confirmLabel = getEditorString(editor, "data-reference-confirm-label", "Insert selected");
    var searchPlaceholder = getEditorString(editor, "data-reference-search-placeholder", "Search posts");
    var selectLabel = getEditorString(editor, "data-reference-select-label", "Select");
    var selectedLabel = getEditorString(editor, "data-reference-selected-label", "Selected");
    var requestId = 0;
    var activePage = 1;
    var latestQuery = "";
    var selectedItem = null;
    var selectedToggle = null;

    if (!searchUrl) {
        return;
    }

    activeReferenceEditor = editor;
    container.className = "editor-modal-form editor-reference-dialog";
    input.className = "input-control";
    input.placeholder = searchPlaceholder;
    results.className = "editor-reference-results";
    resultsGrid.className = "post-grid editor-reference-grid";
    pagination.className = "editor-dialog-pagination pagination-panel";
    paginationStatus.className = "pagination-status";
    paginationActions.className = "pagination-actions";
    previousButton.type = "button";
    previousButton.className = "secondary-button pagination-button";
    previousButton.textContent = "Previous";
    nextButton.type = "button";
    nextButton.className = "secondary-button pagination-button";
    nextButton.textContent = "Next";
    paginationActions.appendChild(previousButton);
    paginationActions.appendChild(nextButton);
    pagination.appendChild(paginationStatus);
    pagination.appendChild(paginationActions);
    results.appendChild(resultsGrid);
    container.appendChild(input);
    container.appendChild(results);
    container.appendChild(pagination);

    function getConfirmButton() {
        return document.querySelector("[data-app-modal-confirm-slot] .primary-button");
    }

    function syncConfirmButton() {
        var confirmButton = getConfirmButton();
        if (!confirmButton) {
            return;
        }
        confirmButton.disabled = !selectedItem;
        confirmButton.classList.toggle("is-disabled", !selectedItem);
    }

    function updateSelection(toggle, item) {
        if (selectedToggle && selectedToggle !== toggle) {
            selectedToggle.classList.remove("is-selected");
            selectedToggle.textContent = selectLabel;
        }
        selectedItem = item || null;
        selectedToggle = toggle || null;
        if (selectedToggle) {
            selectedToggle.classList.add("is-selected");
            selectedToggle.textContent = selectedLabel;
        }
        syncConfirmButton();
    }

    function updatePagination(paginationData, hasItems) {
        var page = paginationData && paginationData.page ? paginationData.page : 1;
        var totalPages = paginationData && paginationData.total_pages ? paginationData.total_pages : 1;
        var hasPrevious = Boolean(paginationData && paginationData.has_previous);
        var hasNext = Boolean(paginationData && paginationData.has_next);

        activePage = page;
        pagination.hidden = !hasItems && totalPages <= 1;
        paginationStatus.textContent = "Page: " + page + " / " + totalPages;
        previousButton.disabled = !hasPrevious;
        nextButton.disabled = !hasNext;
        previousButton.classList.toggle("is-disabled", !hasPrevious);
        nextButton.classList.toggle("is-disabled", !hasNext);
    }

    function renderResults(items) {
        results.innerHTML = "";
        if (!items.length) {
            resultsGrid.hidden = true;
            var empty = document.createElement("p");
            empty.className = "field-help";
            empty.textContent = emptyLabel;
            results.appendChild(empty);
            return;
        }

        resultsGrid.hidden = false;
        results.appendChild(resultsGrid);
        resultsGrid.innerHTML = "";
        items.forEach(function (item) {
            var wrapper = document.createElement("div");
            var card = null;
            var trigger = null;
            var toggle = document.createElement("button");
            wrapper.innerHTML = item.html || "";
            card = wrapper.firstElementChild;
            trigger = wrapper.querySelector("[data-post-card-select]");
            if (!card) {
                return;
            }
            toggle.type = "button";
            toggle.className = "chapter-post-picker-select" + (selectedItem && selectedItem.id === item.id ? " is-selected" : "");
            toggle.textContent = selectedItem && selectedItem.id === item.id ? selectedLabel : selectLabel;
            toggle.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                updateSelection(toggle, item);
            });
            if (trigger) {
                trigger.addEventListener("click", function (event) {
                    event.preventDefault();
                    toggle.click();
                });
            }
            card.classList.add("chapter-post-picker-card");
            card.appendChild(toggle);
            resultsGrid.appendChild(card);
        });
        bindConditionTooltips(resultsGrid);
        bindVipTooltips(resultsGrid);
        syncConfirmButton();
    }

    function fetchResults(query, page) {
        requestId += 1;
        var currentRequestId = requestId;
        var queryText = typeof query === "string" ? query : "";
        var targetPage = page || 1;
        latestQuery = queryText;

        fetch(searchUrl + "?q=" + encodeURIComponent(queryText) + "&page=" + encodeURIComponent(String(targetPage)), { credentials: "same-origin" })
            .then(function (response) {
                return response.json().catch(function () {
                    return { ok: false, items: [], pagination: null };
                });
            })
            .then(function (payload) {
                if (currentRequestId !== requestId) {
                    return;
                }
                var items = payload.ok ? (payload.items || []) : [];
                renderResults(items);
                updatePagination(payload.ok ? payload.pagination : null, items.length > 0);
            })
            .catch(function () {
                if (currentRequestId !== requestId) {
                    return;
                }
                renderResults([]);
                updatePagination(null, false);
            });
    }

    input.addEventListener("input", function () {
        fetchResults(input.value, 1);
    });
    previousButton.addEventListener("click", function () {
        if (previousButton.disabled || activePage <= 1) {
            return;
        }
        fetchResults(latestQuery, activePage - 1);
    });
    nextButton.addEventListener("click", function () {
        if (nextButton.disabled) {
            return;
        }
        fetchResults(latestQuery, activePage + 1);
    });

    openModal({
        kicker: kicker,
        title: title,
        contentNode: container,
        cancelText: cancelLabel,
        confirmText: confirmLabel,
        onConfirm: function () {
            var targetEditor = activeReferenceEditor;
            if (!selectedItem) {
                return;
            }
            insertMarkdownLink(targetEditor, selectedItem.title, selectedItem.url);
        },
        dialogClass: "is-wide-dialog"
    });

    syncConfirmButton();

    fetchResults("", 1);
    window.setTimeout(function () {
        input.focus();
    }, 0);
}

function openLinkDialog(editor) {
    var container = document.createElement("div");
    var nameInput = document.createElement("input");
    var urlInput = document.createElement("input");
    var hint = document.createElement("p");

    container.className = "editor-modal-form";
    nameInput.className = "input-control";
    nameInput.placeholder = getEditorString(editor, "data-link-display-name-label", "Display name");
    urlInput.className = "input-control";
    urlInput.placeholder = getEditorString(editor, "data-link-url-label", "URL");
    hint.className = "field-help";
    hint.textContent = getEditorString(editor, "data-link-help", "Enter display text and the target URL.");
    container.appendChild(nameInput);
    container.appendChild(urlInput);
    container.appendChild(hint);

    openModal({
        kicker: getEditorString(editor, "data-link-kicker", "Markdown"),
        title: getEditorString(editor, "data-link-title", "Insert link"),
        contentNode: container,
        cancelText: getEditorString(editor, "data-link-cancel-label", "Cancel"),
        confirmText: getEditorString(editor, "data-link-confirm-label", "Insert"),
        onConfirm: function () {
            insertMarkdownLink(editor, nameInput.value, urlInput.value);
        }
    });

    window.setTimeout(function () {
        nameInput.focus();
    }, 0);
}

function openImageDialog(editor) {
    var container = document.createElement("div");
    var altInput = document.createElement("input");
    var urlInput = document.createElement("input");
    var hint = document.createElement("p");

    container.className = "editor-modal-form";
    altInput.className = "input-control";
    altInput.placeholder = getEditorString(editor, "data-image-alt-label", "Prompt");
    urlInput.className = "input-control";
    urlInput.placeholder = getEditorString(editor, "data-image-url-label", "Image URL");
    hint.className = "field-help";
    hint.textContent = getEditorString(editor, "data-image-help", "Enter image prompt text and the image URL.");
    container.appendChild(altInput);
    container.appendChild(urlInput);
    container.appendChild(hint);

    openModal({
        kicker: getEditorString(editor, "data-image-kicker", "Markdown"),
        title: getEditorString(editor, "data-image-title", "Insert image"),
        contentNode: container,
        cancelText: getEditorString(editor, "data-link-cancel-label", "Cancel"),
        confirmText: getEditorString(editor, "data-image-confirm-label", "Insert"),
        onConfirm: function () {
            insertMarkdownImage(editor, altInput.value, urlInput.value);
        }
    });

    window.setTimeout(function () {
        altInput.focus();
    }, 0);
}

function openTableDialog(editor, rowCount, columnCount, initialRows) {
    var rows = normalizeImportedTableRows(initialRows);
    var rowsTotal = Math.max(2, rows.length || rowCount || 3);
    var columnsTotal = Math.max(1, rows.length && rows[0] ? rows[0].length : columnCount || 3);
    var container = document.createElement("div");
    var summary = document.createElement("div");
    var tableShell = document.createElement("div");
    var helper = document.createElement("p");
    var tableHelpPrimary = getEditorString(editor, "data-table-help-context-label", "Right-click a cell to insert or remove rows and columns.");
    var tableHelpSecondary = getEditorString(editor, "data-table-help-paste-label", "Use tabs or | to paste cells, one row per line.");
    var contextLabels = {
        insertRowAbove: getEditorString(editor, "data-table-insert-row-above-label", "Insert row above"),
        insertRowBelow: getEditorString(editor, "data-table-insert-row-below-label", "Insert row below"),
        insertColumnLeft: getEditorString(editor, "data-table-insert-column-left-label", "Insert column left"),
        insertColumnRight: getEditorString(editor, "data-table-insert-column-right-label", "Insert column right"),
        removeRow: getEditorString(editor, "data-table-remove-row-label", "Remove row"),
        removeColumn: getEditorString(editor, "data-table-remove-column-label", "Remove column")
    };

    function createEmptyRow(size) {
        var row = [];
        var index = 0;
        for (index = 0; index < size; index += 1) {
            row.push("");
        }
        return row;
    }

    function focusCell(targetRowIndex, targetColumnIndex) {
        window.requestAnimationFrame(function () {
            var selector = '[data-table-row-index="' + targetRowIndex + '"][data-table-column-index="' + targetColumnIndex + '"]';
            var input = tableShell.querySelector(selector);
            if (input) {
                input.focus();
                if (typeof input.select === "function") {
                    input.select();
                }
            }
        });
    }

    function insertRowAt(rowIndex) {
        rows.splice(rowIndex, 0, createEmptyRow(rows[0].length));
        renderGrid();
        focusCell(rowIndex, 0);
    }

    function insertColumnAt(columnIndex) {
        rows.forEach(function (row) {
            row.splice(columnIndex, 0, "");
        });
        renderGrid();
        focusCell(0, columnIndex);
    }

    function removeRowAt(rowIndex) {
        if (rows.length <= 2) {
            return;
        }
        rows.splice(rowIndex, 1);
        renderGrid();
        focusCell(Math.min(rowIndex, rows.length - 1), 0);
    }

    function removeColumnAt(columnIndex) {
        if (rows[0].length <= 1) {
            return;
        }
        rows.forEach(function (row) {
            row.splice(columnIndex, 1);
        });
        renderGrid();
        focusCell(0, Math.min(columnIndex, rows[0].length - 1));
    }

    function openCellContextMenu(event, rowIndex, columnIndex) {
        event.preventDefault();
        event.stopPropagation();
        openTableContextMenu(event, [
            {
                label: contextLabels.insertRowAbove,
                onClick: function () { insertRowAt(rowIndex); }
            },
            {
                label: contextLabels.insertRowBelow,
                onClick: function () { insertRowAt(rowIndex + 1); }
            },
            {
                label: contextLabels.insertColumnLeft,
                onClick: function () { insertColumnAt(columnIndex); }
            },
            {
                label: contextLabels.insertColumnRight,
                onClick: function () { insertColumnAt(columnIndex + 1); }
            },
            {
                label: contextLabels.removeRow,
                disabled: rows.length <= 2,
                isDanger: true,
                onClick: function () { removeRowAt(rowIndex); }
            },
            {
                label: contextLabels.removeColumn,
                disabled: rows[0].length <= 1,
                isDanger: true,
                onClick: function () { removeColumnAt(columnIndex); }
            }
        ], { rowIndex: rowIndex, columnIndex: columnIndex });
    }

    function renderGrid() {
        var table = document.createElement("table");
        var thead = document.createElement("thead");
        var tbody = document.createElement("tbody");
        var headerRow = document.createElement("tr");

        table.className = "editor-table-dialog-grid";
        tableShell.innerHTML = "";

        rows[0].forEach(function (_cell, columnIndex) {
            var headerCell = document.createElement("th");
            var input = document.createElement("input");
            input.type = "text";
            input.className = "input-control editor-table-dialog-input editor-table-dialog-input-header";
            input.setAttribute("data-table-row-index", "0");
            input.setAttribute("data-table-column-index", String(columnIndex));
            input.placeholder = "Header " + (columnIndex + 1);
            input.value = rows[0][columnIndex];
            input.addEventListener("input", function () {
                rows[0][columnIndex] = input.value;
            });
            headerCell.addEventListener("contextmenu", function (event) {
                openCellContextMenu(event, 0, columnIndex);
            });
            input.addEventListener("contextmenu", function (event) {
                openCellContextMenu(event, 0, columnIndex);
            });
            headerCell.appendChild(input);
            headerRow.appendChild(headerCell);
        });
        thead.appendChild(headerRow);

        rows.slice(1).forEach(function (row, rowIndex) {
            var bodyRow = document.createElement("tr");
            row.forEach(function (_cell, columnIndex) {
                var bodyCell = document.createElement("td");
                var input = document.createElement("input");
                input.type = "text";
                input.className = "input-control editor-table-dialog-input";
                input.setAttribute("data-table-row-index", String(rowIndex + 1));
                input.setAttribute("data-table-column-index", String(columnIndex));
                input.value = rows[rowIndex + 1][columnIndex];
                input.addEventListener("input", function () {
                    rows[rowIndex + 1][columnIndex] = input.value;
                });
                bodyCell.addEventListener("contextmenu", function (event) {
                    openCellContextMenu(event, rowIndex + 1, columnIndex);
                });
                input.addEventListener("contextmenu", function (event) {
                    openCellContextMenu(event, rowIndex + 1, columnIndex);
                });
                bodyCell.appendChild(input);
                bodyRow.appendChild(bodyCell);
            });
            tbody.appendChild(bodyRow);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        tableShell.appendChild(table);
        summary.textContent = rows.length + " x " + rows[0].length;

        if (tableContextMenuState) {
            focusCell(
                Math.min(tableContextMenuState.rowIndex, rows.length - 1),
                Math.min(tableContextMenuState.columnIndex, rows[0].length - 1)
            );
        }
    }

    while (rows.length < rowsTotal) {
        rows.push(createEmptyRow(columnsTotal));
    }

    rows = rows.map(function (row) {
        var normalizedRow = row.slice();
        while (normalizedRow.length < columnsTotal) {
            normalizedRow.push("");
        }
        return normalizedRow;
    });

    container.className = "editor-modal-form editor-table-dialog";
    summary.className = "editor-table-dialog-summary";
    tableShell.className = "editor-table-dialog-shell";
    helper.className = "field-help";
    helper.innerHTML = escapeHtml(tableHelpPrimary) + "<br>" + escapeHtml(tableHelpSecondary);
    container.appendChild(summary);
    container.appendChild(tableShell);
    container.appendChild(helper);
    renderGrid();

    openModal({
        kicker: getEditorString(editor, "data-table-kicker", "Markdown"),
        title: getEditorString(editor, "data-table-title", "Insert table"),
        dialogClass: "is-table-dialog",
        contentNode: container,
        cancelText: getEditorString(editor, "data-link-cancel-label", "Cancel"),
        confirmText: getEditorString(editor, "data-table-confirm-label", "Insert"),
        onCancel: closeTableContextMenu,
        onConfirm: function () {
            var markdown = null;
            closeTableContextMenu();
            markdown = buildMarkdownTableFromGrid(rows);
            if (!markdown || !editor || !editor.codemirror) {
                return;
            }
            editor.codemirror.replaceSelection(markdown);
            editor.codemirror.focus();
        }
    });

    window.setTimeout(function () {
        var firstInput = tableShell.querySelector("input");
        if (firstInput) {
            firstInput.focus();
        }
    }, 0);
}

function createTablePicker() {
    var picker = null;
    var summary = null;
    var grid = null;
    var row = 0;
    var column = 0;
    var maxRows = 6;
    var maxColumns = 6;

    if (tablePicker) {
        return tablePicker;
    }

    picker = document.createElement("div");
    summary = document.createElement("div");
    grid = document.createElement("div");
    picker.className = "editor-table-picker";
    picker.hidden = true;
    picker.setAttribute("data-editor-table-picker", "true");
    summary.className = "editor-table-picker-summary";
    summary.textContent = "Select table size";
    grid.className = "editor-table-picker-grid";

    function updateTablePickerState(rowCount, columnCount) {
        summary.textContent = rowCount + " x " + columnCount;
        Array.prototype.forEach.call(grid.children, function (cell) {
            var cellRow = Number(cell.getAttribute("data-row") || "0");
            var cellColumn = Number(cell.getAttribute("data-column") || "0");
            var isActive = cellRow <= rowCount && cellColumn <= columnCount;
            cell.classList.toggle("is-active", isActive);
        });
    }

    for (row = 1; row <= maxRows; row += 1) {
        for (column = 1; column <= maxColumns; column += 1) {
            var cell = document.createElement("button");
            cell.type = "button";
            cell.className = "editor-table-picker-cell";
            cell.setAttribute("data-row", String(row));
            cell.setAttribute("data-column", String(column));
            cell.setAttribute("aria-label", row + " x " + column);
            cell.addEventListener("mouseenter", function () {
                updateTablePickerState(Number(this.getAttribute("data-row")), Number(this.getAttribute("data-column")));
            });
            cell.addEventListener("focus", function () {
                updateTablePickerState(Number(this.getAttribute("data-row")), Number(this.getAttribute("data-column")));
            });
            cell.addEventListener("click", function () {
                var selectedEditor = activeTableEditor;
                closeTablePicker();
                openTableDialog(selectedEditor, Number(this.getAttribute("data-row")), Number(this.getAttribute("data-column")));
            });
            grid.appendChild(cell);
        }
    }

    picker.addEventListener("mouseleave", function () {
        summary.textContent = "Select table size";
        Array.prototype.forEach.call(grid.children, function (cell) {
            cell.classList.remove("is-active");
        });
    });

    picker.appendChild(summary);
    picker.appendChild(grid);
    document.body.appendChild(picker);
    tablePicker = picker;
    return tablePicker;
}

function closeTablePicker() {
    if (!tablePicker) {
        return;
    }
    tablePicker.hidden = true;
    activeTableEditor = null;
}

function wrapSelectionWithColor(editor, colorClass) {
    var doc = null;
    var selection = "";
    var placeholder = "Colored text";
    var cursor = null;
    var prefix = '<span class="' + colorClass + '">';
    if (!editor || !editor.codemirror || !colorClass) {
        return;
    }
    doc = editor.codemirror.getDoc();
    selection = doc.getSelection();
    cursor = doc.getCursor("from");
    doc.replaceSelection(prefix + escapeHtml(selection || placeholder) + "</span>");
    if (!selection) {
        doc.setSelection(
            { line: cursor.line, ch: cursor.ch + prefix.length },
            { line: cursor.line, ch: cursor.ch + prefix.length + placeholder.length }
        );
    }
    editor.codemirror.focus();
}

function insertEmoji(editor, emoji) {
    if (!editor || !editor.codemirror || !emoji) {
        return;
    }
    editor.codemirror.replaceSelection(emoji);
    editor.codemirror.focus();
}

function renderMarkdownHtml(plainText, markdownRenderer) {
    return markdownRenderer(plainText || "");
}

function normalizeNestedTables(plainText) {
    var lines = (plainText || "").split(/\r?\n/);
    var normalizedLines = [];
    var index = 0;

    while (index < lines.length) {
        var line = lines[index];
        var listMatch = line.match(/^(\s*)([-+*]|\d+\.)\s+.*$/);
        normalizedLines.push(line);

        if (!listMatch) {
            index += 1;
            continue;
        }

        var listIndent = listMatch[1].length;
        var tableLines = [];
        var lookAhead = index + 1;

        while (lookAhead < lines.length) {
            var nextLine = lines[lookAhead];
            var stripped = nextLine.trim();
            var nextIndent = nextLine.length - nextLine.replace(/^\s*/, "").length;
            if (!stripped || nextIndent <= listIndent || stripped.charAt(0) !== "|") {
                break;
            }
            tableLines.push(nextLine);
            lookAhead += 1;
        }

        if (tableLines.length >= 2) {
            normalizedLines.push("");
            Array.prototype.push.apply(normalizedLines, tableLines);
            index = lookAhead;
            continue;
        }

        index += 1;
    }

    return normalizedLines.join("\n");
}

function normalizeIndentedTables(plainText) {
    return (plainText || "").split(/\r?\n/).map(function (line) {
        return line.indexOf("    |") === 0 ? line.slice(4) : line;
    }).join("\n");
}

function hasListSyntax(plainText) {
    return /^\s*(?:[-+*]|\d+\.)\s+/m.test(plainText || "");
}

function parsePipeTable(tableLines) {
    function splitRow(row) {
        var stripped = row.trim();
        if (stripped.charAt(0) === "|") {
            stripped = stripped.slice(1);
        }
        if (stripped.charAt(stripped.length - 1) === "|") {
            stripped = stripped.slice(0, -1);
        }
        return stripped.split("|").map(function (cell) {
            return cell.trim();
        });
    }

    var separatorRe = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
    var headers = [];
    var rows = [];
    if (!tableLines || tableLines.length < 2 || !separatorRe.test(tableLines[1])) {
        return "";
    }
    headers = splitRow(tableLines[0]);
    rows = tableLines.slice(2).map(splitRow);

    return "<table><thead><tr>" + headers.map(function (header) {
        return "<th>" + escapeHtml(header) + "</th>";
    }).join("") + "</tr></thead><tbody>" + rows.map(function (row) {
        var padded = row.slice();
        while (padded.length < headers.length) {
            padded.push("");
        }
        return "<tr>" + padded.slice(0, headers.length).map(function (cell) {
            return "<td>" + escapeHtml(cell) + "</td>";
        }).join("") + "</tr>";
    }).join("") + "</tbody></table>";
}

function renderInlineMarkdown(text, markdownRenderer) {
    var rendered = renderMarkdownHtml(text || "", markdownRenderer);
    if (rendered.indexOf("<p>") === 0 && rendered.slice(-4) === "</p>") {
        return rendered.slice(3, -4);
    }
    return rendered;
}

function buildListItemHtml(bodyLines, markdownRenderer) {
    var paragraphLines = bodyLines.length ? [bodyLines[0]] : [];
    var extraBlocks = [];
    var index = 1;

    while (index < bodyLines.length) {
        var current = bodyLines[index];
        if (!current.trim()) {
            index += 1;
            continue;
        }
        if (current.trim().charAt(0) === "|") {
            var tableLines = [];
            var tableHtml = "";
            while (index < bodyLines.length && bodyLines[index].trim().charAt(0) === "|") {
                tableLines.push(bodyLines[index]);
                index += 1;
            }
            tableHtml = parsePipeTable(tableLines);
            if (tableHtml) {
                extraBlocks.push(tableHtml);
                continue;
            }
            extraBlocks.push(renderMarkdownHtml(tableLines.join("\n"), markdownRenderer));
            continue;
        }
        paragraphLines.push(current);
        index += 1;
    }

    return "<li>" + renderInlineMarkdown(paragraphLines.join("\n").trim(), markdownRenderer) + extraBlocks.join("") + "</li>";
}

function renderListBlocks(text, markdownRenderer) {
    var lines = (text || "").split(/\r?\n/);
    var renderedLines = [];
    var index = 0;

    while (index < lines.length) {
        var line = lines[index];
        var listMatch = line.match(/^(\s*)([-+*]|\d+\.)\s+(.*)$/);
        if (!listMatch) {
            renderedLines.push(line);
            index += 1;
            continue;
        }

        var listIndent = listMatch[1];
        var marker = listMatch[2];
        var listTag = /\.$/.test(marker) ? "ol" : "ul";
        var items = [];

        while (index < lines.length) {
            var itemMatch = lines[index].match(new RegExp("^" + listIndent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([-+*]|\\d+\\.)\\s+(.*)$"));
            if (!itemMatch) {
                break;
            }

            var bodyLines = [itemMatch[2]];
            index += 1;
            while (index < lines.length) {
                var candidate = lines[index];
                var candidateIndent = candidate.length - candidate.replace(/^\s*/, "").length;
                if (!candidate.trim()) {
                    bodyLines.push("");
                    index += 1;
                    continue;
                }
                if (candidateIndent <= listIndent.length) {
                    break;
                }
                bodyLines.push(candidate.slice(listIndent.length + 4));
                index += 1;
            }
            items.push(buildListItemHtml(bodyLines, markdownRenderer));
        }
        renderedLines.push("<" + listTag + ">" + items.join("") + "</" + listTag + ">");
    }

    return renderedLines.join("\n");
}

function collectIndentedBlock(lines, startIndex, baseIndent) {
    var blockLines = [];
    var cursor = startIndex;

    while (cursor < lines.length) {
        var candidate = lines[cursor];
        if (!candidate.trim()) {
            blockLines.push("");
            cursor += 1;
            continue;
        }
        var indent = candidate.length - candidate.replace(/^\s*/, "").length;
        if (indent < baseIndent) {
            break;
        }
        blockLines.push(candidate.slice(baseIndent));
        cursor += 1;
    }

    while (blockLines.length && !blockLines[0].trim()) {
        blockLines.shift();
    }
    while (blockLines.length && !blockLines[blockLines.length - 1].trim()) {
        blockLines.pop();
    }

    return { lines: blockLines, nextIndex: cursor };
}

function parseAdmonitionLine(line) {
    var match = line.match(/^\s*\?\?\?(\+)?\s+(note|tip|warning)(?:\s+"([^"]+)")?\s*$/i);
    if (!match) {
        return null;
    }
    return {
        isOpen: Boolean(match[1]),
        type: match[2].toLowerCase(),
        title: match[3] || ""
    };
}

function humanizeCalloutType(calloutType) {
    var labelMap = {
        note: "Note",
        tip: "Tip",
        important: "Important",
        caution: "Caution",
        warning: "Warning"
    };
    return labelMap[calloutType] || calloutType;
}

function renderMarkdownPreview(plainText, markdownRenderer) {
    var lines = (plainText || "").split(/\r?\n/);
    var chunks = [];
    var markdownBuffer = [];
    var index = 0;

    function renderNormalizedMarkdown(text) {
        var normalized = normalizeNestedTables(text);
        var looseBlocks = [];
        if (hasListSyntax(normalized)) {
            return renderListBlocks(normalized, markdownRenderer);
        }
        looseBlocks = splitLooseMarkdownBlocks(normalizeIndentedTables(normalized));
        if (looseBlocks.length > 1) {
            return looseBlocks.map(function (block) {
                return renderMarkdownHtml(block, markdownRenderer);
            }).join("");
        }
        return renderMarkdownHtml(normalizeIndentedTables(normalized), markdownRenderer);
    }

    function flushMarkdownBuffer() {
        if (!markdownBuffer.length) {
            return;
        }
        chunks.push(renderNormalizedMarkdown(markdownBuffer.join("\n")));
        markdownBuffer = [];
    }

    function renderTabs(tabItems) {
        var tabGroupId = "markdown-preview-tabs-" + markdownPreviewCounter;
        var navHtml = [];
        var panelHtml = [];
        markdownPreviewCounter += 1;

        tabItems.forEach(function (tabItem, tabIndex) {
            var isActive = tabIndex === 0;
            var targetId = tabGroupId + "-panel-" + tabIndex;
            navHtml.push(
                '<button class="markdown-tab-button' + (isActive ? ' is-active' : '') + '" type="button" data-tab-group="' + tabGroupId + '" data-tab-target="' + targetId + '" aria-selected="' + (isActive ? 'true' : 'false') + '">' + escapeHtml(tabItem.title) + '</button>'
            );
            panelHtml.push(
                '<section class="markdown-tab-panel' + (isActive ? ' is-active' : '') + '" data-tab-panel="' + targetId + '" data-tab-group="' + tabGroupId + '"' + (isActive ? '' : ' hidden') + '>' + renderNormalizedMarkdown(tabItem.content) + '</section>'
            );
        });

        return '<div class="markdown-tabs"><div class="markdown-tabs-nav">' + navHtml.join("") + '</div><div class="markdown-tabs-panels">' + panelHtml.join("") + '</div></div>';
    }

    function renderAdmonition(admonitionType, contentLines, title, isOpen) {
        return '<details class="markdown-admonition markdown-admonition-' + admonitionType + '"' + (isOpen ? ' open' : '') + '>' +
            '<summary class="markdown-admonition-summary">' + escapeHtml(title || humanizeCalloutType(admonitionType)) + '</summary>' +
            '<div class="markdown-admonition-body">' + renderNormalizedMarkdown(contentLines.join("\n")) + '</div></details>';
    }

    while (index < lines.length) {
        var line = lines[index];
        var calloutMatch = line.match(/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]\s*(.*)$/i);
        var tabsMatch = line.match(/^\s*===\s+"([^"]+)"\s*$/);
        var admonitionMatch = parseAdmonitionLine(line);

        if (tabsMatch) {
            var tabItems = [];
            flushMarkdownBuffer();
            while (index < lines.length) {
                var currentTabMatch = lines[index].match(/^\s*===\s+"([^"]+)"\s*$/);
                var tabBlock = null;
                if (!currentTabMatch) {
                    break;
                }
                tabBlock = collectIndentedBlock(lines, index + 1, 4);
                tabItems.push({ title: currentTabMatch[1], content: tabBlock.lines.join("\n") });
                index = tabBlock.nextIndex;
            }
            if (tabItems.length) {
                chunks.push(renderTabs(tabItems));
            }
            continue;
        }

        if (admonitionMatch) {
            var admonitionBlock = collectIndentedBlock(lines, index + 1, 4);
            flushMarkdownBuffer();
            chunks.push(renderAdmonition(admonitionMatch.type, admonitionBlock.lines, admonitionMatch.title, admonitionMatch.isOpen));
            index = admonitionBlock.nextIndex;
            continue;
        }

        if (!calloutMatch) {
            markdownBuffer.push(line);
            index += 1;
            continue;
        }

        flushMarkdownBuffer();
        var calloutType = calloutMatch[1].toLowerCase();
        var calloutLines = [];
        var inlineText = (calloutMatch[2] || "").trim();
        if (inlineText) {
            calloutLines.push(inlineText);
        }
        index += 1;
        while (index < lines.length) {
            var quotedMatch = lines[index].match(/^\s*>\s?(.*)$/);
            if (!quotedMatch) {
                break;
            }
            calloutLines.push(quotedMatch[1]);
            index += 1;
        }
        chunks.push('<blockquote class="markdown-callout markdown-callout-' + calloutType + '"><p class="markdown-callout-title">' + humanizeCalloutType(calloutType) + '</p>' + renderNormalizedMarkdown(calloutLines.join("\n").trim()) + '</blockquote>');
    }

    flushMarkdownBuffer();
    return chunks.join("");
}

function renderMarkdownPreviewFallback(plainText, markdownRenderer) {
    return renderMarkdownPreview(plainText, markdownRenderer);
}

function renderMathInContainer(container) {
    if (!container || !window.renderMathInElement) {
        return;
    }
    window.renderMathInElement(container, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
    });
}

function bindMarkdownTabs(rootNode) {
    if (!rootNode || rootNode.getAttribute("data-markdown-tabs-bound") === "true") {
        return;
    }
    rootNode.setAttribute("data-markdown-tabs-bound", "true");
    rootNode.addEventListener("click", function (event) {
        var button = event.target.closest(".markdown-tab-button");
        var targetId = "";
        var groupId = "";
        if (!button || !rootNode.contains(button)) {
            return;
        }
        targetId = button.getAttribute("data-tab-target") || "";
        groupId = button.getAttribute("data-tab-group") || "";
        Array.prototype.forEach.call(rootNode.querySelectorAll('.markdown-tab-button[data-tab-group="' + groupId + '"]'), function (tabButton) {
            var isActive = tabButton === button;
            tabButton.classList.toggle("is-active", isActive);
            tabButton.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        Array.prototype.forEach.call(rootNode.querySelectorAll('.markdown-tab-panel[data-tab-group="' + groupId + '"]'), function (panel) {
            var isActive = panel.getAttribute("data-tab-panel") === targetId;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });
    });
}

function parseOverflowLimit(rootNode, attributeName, fallbackValue) {
    var rawValue = rootNode ? rootNode.getAttribute(attributeName) : "";
    var limit = parseInt(rawValue || "", 10);

    if (!limit || limit < 1) {
        return fallbackValue;
    }
    return limit;
}

function getOverflowText(rootNode, attributeName, fallbackValue) {
    var value = rootNode ? rootNode.getAttribute(attributeName) : "";
    return value || fallbackValue;
}

function buildOverflowToggle(rootNode, hiddenCount, buttonClassName) {
    var overlay = document.createElement("div");
    var hint = document.createElement("span");
    var button = document.createElement("button");
    var hintTemplate = getOverflowText(rootNode, "data-overflow-hint", "Hidden %count% more lines");
    var buttonLabel = getOverflowText(rootNode, "data-overflow-expand-label", "Show all");

    overlay.className = "markdown-overflow-overlay";
    hint.className = "markdown-overflow-hint";
    hint.textContent = hintTemplate.replace(/%count%/g, String(hiddenCount));
    button.type = "button";
    button.className = buttonClassName;
    button.textContent = buttonLabel;
    overlay.appendChild(hint);
    overlay.appendChild(button);
    return { overlay: overlay, button: button };
}

function enhanceCollapsibleCodeBlocks(rootNode) {
    var codeLineLimit = parseOverflowLimit(rootNode, "data-overflow-code-lines", 12);

    if (!rootNode) {
        return;
    }

    Array.prototype.forEach.call(rootNode.querySelectorAll("pre[data-code-copy-ready='true']"), function (preNode) {
        var layoutNode = preNode.querySelector(":scope > .code-block-layout");
        var lines = layoutNode ? layoutNode.querySelectorAll(":scope > .code-line") : [];
        var hiddenCount = 0;
        var overlayParts = null;

        if (!layoutNode || preNode.getAttribute("data-overflow-ready") === "true") {
            return;
        }

        preNode.setAttribute("data-overflow-ready", "true");
        if (!lines.length || lines.length <= codeLineLimit) {
            return;
        }

        hiddenCount = lines.length - codeLineLimit;
        preNode.classList.add("is-collapsed", "is-code-collapsed");
        preNode.style.setProperty("--code-visible-lines", String(codeLineLimit));
        overlayParts = buildOverflowToggle(rootNode, hiddenCount, "markdown-overflow-button code-overflow-button");
        overlayParts.button.addEventListener("click", function () {
            preNode.classList.remove("is-collapsed");
            overlayParts.overlay.remove();
        });
        preNode.appendChild(overlayParts.overlay);
    });
}

function enhanceCollapsibleTables(rootNode) {
    var tableRowLimit = parseOverflowLimit(rootNode, "data-overflow-table-rows", 6);

    if (!rootNode) {
        return;
    }

    Array.prototype.forEach.call(rootNode.querySelectorAll("table"), function (tableNode) {
        var body = tableNode.tBodies && tableNode.tBodies.length ? tableNode.tBodies[0] : null;
        var rows = body ? body.rows : [];
        var wrapper = null;
        var hiddenCount = 0;
        var overlayParts = null;

        if (!body || tableNode.getAttribute("data-overflow-ready") === "true") {
            return;
        }

        tableNode.setAttribute("data-overflow-ready", "true");
        if (!rows.length || rows.length <= tableRowLimit) {
            return;
        }

        hiddenCount = rows.length - tableRowLimit;
        wrapper = document.createElement("div");
        wrapper.className = "markdown-table-overflow is-collapsed";
        wrapper.style.setProperty("--table-visible-rows", String(tableRowLimit));
        tableNode.parentNode.insertBefore(wrapper, tableNode);
        wrapper.appendChild(tableNode);
        overlayParts = buildOverflowToggle(rootNode, hiddenCount, "markdown-overflow-button table-overflow-button");
        overlayParts.button.addEventListener("click", function () {
            wrapper.classList.remove("is-collapsed");
            overlayParts.overlay.remove();
        });
        wrapper.appendChild(overlayParts.overlay);
    });
}

function enhanceCodeCopyBlocks(rootNode) {
    var copyLabel = "";
    var copiedLabel = "";
    var failedLabel = "";

    if (!rootNode || rootNode.getAttribute("data-code-copy-enabled") !== "true") {
        return;
    }
    copyLabel = rootNode.getAttribute("data-code-copy-label") || "Copy";
    copiedLabel = rootNode.getAttribute("data-code-copied-label") || "Copied";
    failedLabel = rootNode.getAttribute("data-code-copy-failed-label") || "Failed";

    Array.prototype.forEach.call(rootNode.querySelectorAll("pre"), function (preNode) {
        var button = null;
        var codeNode = null;
        var codeText = "";
        var layoutNode = null;
        var resetTimer = null;

        function hasVisibleLineContent(lineModel) {
            return lineModel.nodes.length > 0;
        }

        function splitNodeIntoLines(node) {
            var childLines = null;
            var isHighlightedNode = false;
            var lines = [{ nodes: [], highlighted: false }];
            var lastLine = null;
            var index = 0;
            var clone = null;

            if (!node) {
                return lines;
            }
            if (node.nodeType === window.Node.TEXT_NODE) {
                return (node.textContent || "").replace(/\r\n?/g, "\n").split("\n").map(function (part) {
                    return { nodes: part ? [document.createTextNode(part)] : [], highlighted: false };
                });
            }
            if (node.nodeType !== window.Node.ELEMENT_NODE) {
                return lines;
            }
            isHighlightedNode = node.classList.contains("hll");

            Array.prototype.forEach.call(node.childNodes, function (childNode) {
                childLines = splitNodeIntoLines(childNode);
                lastLine = lines[lines.length - 1];
                Array.prototype.push.apply(lastLine.nodes, childLines[0].nodes);
                lastLine.highlighted = lastLine.highlighted || childLines[0].highlighted;
                for (index = 1; index < childLines.length; index += 1) {
                    lines.push(childLines[index]);
                }
            });

            return lines.map(function (lineModel) {
                if (!lineModel.nodes.length) {
                    return { nodes: [], highlighted: lineModel.highlighted || isHighlightedNode };
                }
                clone = node.cloneNode(false);
                Array.prototype.forEach.call(lineModel.nodes, function (lineNode) {
                    clone.appendChild(lineNode);
                });
                return { nodes: [clone], highlighted: lineModel.highlighted || isHighlightedNode };
            });
        }

        function buildCodeLineModels(sourceCodeNode, rawText) {
            var lines = [{ nodes: [], highlighted: false }];
            var childLines = null;
            var lastLine = null;
            var normalizedText = (rawText || "").replace(/\r\n?/g, "\n");
            var index = 0;

            Array.prototype.forEach.call(sourceCodeNode.childNodes, function (childNode) {
                childLines = splitNodeIntoLines(childNode);
                lastLine = lines[lines.length - 1];
                Array.prototype.push.apply(lastLine.nodes, childLines[0].nodes);
                lastLine.highlighted = lastLine.highlighted || childLines[0].highlighted;
                for (index = 1; index < childLines.length; index += 1) {
                    lines.push(childLines[index]);
                }
            });

            if (normalizedText.slice(-1) === "\n" && lines.length > 1 && !hasVisibleLineContent(lines[lines.length - 1])) {
                lines.pop();
            }
            return lines.length ? lines : [{ nodes: [], highlighted: false }];
        }

        function buildCodeBlockLayout(sourceCodeNode, rawText) {
            var lineModels = buildCodeLineModels(sourceCodeNode, rawText);
            var fragment = document.createDocumentFragment();
            var lineWrapper = null;
            var lineNumberNode = null;
            var lineContentNode = null;
            var index = 0;

            layoutNode = document.createElement("span");
            layoutNode.className = "code-block-layout";

            for (index = 0; index < lineModels.length; index += 1) {
                lineWrapper = document.createElement("span");
                lineWrapper.className = "code-line" + (lineModels[index].highlighted ? " is-highlighted" : "");
                lineNumberNode = document.createElement("span");
                lineNumberNode.className = "code-line-number";
                lineNumberNode.setAttribute("aria-hidden", "true");
                lineNumberNode.textContent = String(index + 1);
                lineContentNode = document.createElement("span");
                lineContentNode.className = "code-line-content";
                Array.prototype.forEach.call(lineModels[index].nodes, function (lineNode) {
                    lineContentNode.appendChild(lineNode);
                });
                lineWrapper.appendChild(lineNumberNode);
                lineWrapper.appendChild(lineContentNode);
                fragment.appendChild(lineWrapper);
            }

            layoutNode.appendChild(fragment);
            return layoutNode;
        }

        function setButtonIcon(state) {
            var iconClassName = "fa-regular fa-copy";
            if (state === "copied") {
                iconClassName = "fa-solid fa-check";
            } else if (state === "error") {
                iconClassName = "fa-solid fa-xmark";
            }
            button.innerHTML = '<i class="' + iconClassName + '" aria-hidden="true"></i>';
        }

        function updateButtonState(label, stateClassName) {
            var iconState = "default";
            button.classList.remove("is-copied", "is-error");
            if (stateClassName) {
                button.classList.add(stateClassName);
            }
            if (stateClassName === "is-copied") {
                iconState = "copied";
            } else if (stateClassName === "is-error") {
                iconState = "error";
            }
            setButtonIcon(iconState);
            button.setAttribute("aria-label", label);
            button.setAttribute("title", label);
        }

        if (preNode.getAttribute("data-code-copy-ready") === "true") {
            return;
        }
        codeNode = preNode.querySelector("code");
        codeText = codeNode ? (codeNode.textContent || "") : (preNode.textContent || "");
        if (codeNode && !preNode.querySelector(".code-block-layout")) {
            layoutNode = buildCodeBlockLayout(codeNode, codeText);
            preNode.insertBefore(layoutNode, codeNode);
            codeNode.remove();
        }

        preNode.setAttribute("data-code-copy-ready", "true");
        button = document.createElement("button");
        button.type = "button";
        button.className = "code-copy-button";
        updateButtonState(copyLabel, "");

        button.addEventListener("click", function () {
            if (!codeText) {
                return;
            }
            button.disabled = true;
            window.clearTimeout(resetTimer);
            copyTextToClipboard(codeText)
                .then(function () {
                    updateButtonState(copiedLabel, "is-copied");
                })
                .catch(function () {
                    updateButtonState(failedLabel, "is-error");
                })
                .then(function () {
                    resetTimer = window.setTimeout(function () {
                        updateButtonState(copyLabel, "");
                        button.disabled = false;
                    }, 1800);
                });
        });

        preNode.appendChild(button);
    });
}

export function enhanceMarkdownContainer(rootNode) {
    if (!rootNode) {
        return;
    }
    bindMarkdownTabs(rootNode);
    renderMathInContainer(rootNode);
    enhanceCodeCopyBlocks(rootNode);
    enhanceCollapsibleCodeBlocks(rootNode);
    enhanceCollapsibleTables(rootNode);
    bindInternalPostLinkPreviews(rootNode);
}

function createColorPicker() {
    var picker = null;
    var summary = null;
    var palette = null;
    if (colorPicker) {
        return colorPicker;
    }

    picker = document.createElement("div");
    summary = document.createElement("div");
    palette = document.createElement("div");
    picker.className = "editor-color-picker";
    picker.hidden = true;
    picker.setAttribute("data-editor-color-picker", "true");
    summary.className = "editor-color-picker-summary";
    summary.textContent = "Text color";
    palette.className = "editor-color-picker-grid";

    markdownTextColors.forEach(function (colorItem) {
        var button = document.createElement("button");
        var swatch = document.createElement("span");
        var label = document.createElement("span");
        button.type = "button";
        button.className = "editor-color-picker-swatch";
        button.setAttribute("aria-label", colorItem.label);
        button.setAttribute("title", colorItem.label);
        button.addEventListener("click", function () {
            restoreEditorSelection(activeColorEditor, activeColorSelectionState);
            wrapSelectionWithColor(activeColorEditor, colorItem.className);
            closeColorPicker();
        });
        swatch.className = "editor-color-picker-dot";
        swatch.style.background = colorItem.color;
        label.className = "editor-color-picker-label";
        label.textContent = colorItem.label;
        button.appendChild(swatch);
        button.appendChild(label);
        palette.appendChild(button);
    });

    picker.appendChild(summary);
    picker.appendChild(palette);
    document.body.appendChild(picker);
    colorPicker = picker;
    return colorPicker;
}

function createEmojiPicker() {
    var picker = null;
    var summary = null;
    var grid = null;
    if (emojiPicker) {
        return emojiPicker;
    }
    picker = document.createElement("div");
    summary = document.createElement("div");
    grid = document.createElement("div");
    picker.className = "editor-emoji-picker";
    picker.hidden = true;
    picker.setAttribute("data-editor-emoji-picker", "true");
    summary.className = "editor-emoji-picker-summary";
    summary.textContent = "Insert emoji";
    grid.className = "editor-emoji-picker-grid";

    markdownEmojis.forEach(function (emoji) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "editor-emoji-picker-item";
        button.setAttribute("aria-label", emoji);
        button.textContent = emoji;
        button.addEventListener("click", function () {
            restoreEditorSelection(activeEmojiEditor, activeEmojiSelectionState);
            insertEmoji(activeEmojiEditor, emoji);
            closeEmojiPicker();
        });
        grid.appendChild(button);
    });

    picker.appendChild(summary);
    picker.appendChild(grid);
    document.body.appendChild(picker);
    emojiPicker = picker;
    return emojiPicker;
}

function closeColorPicker(preserveContextSelection) {
    if (!colorPicker) {
        return;
    }
    colorPicker.hidden = true;
    activeColorEditor = null;
    activeColorSelectionState = null;
    activeColorPickerMode = "toolbar";
    if (!preserveContextSelection) {
        clearEditorContextSelection();
    }
}

function closeEmojiPicker(preserveContextSelection) {
    if (!emojiPicker) {
        return;
    }
    emojiPicker.hidden = true;
    activeEmojiEditor = null;
    activeEmojiSelectionState = null;
    activeEmojiPickerMode = "toolbar";
    if (!preserveContextSelection) {
        clearEditorContextSelection();
    }
}

function openTablePicker(editor, anchorElement) {
    var picker = createTablePicker();
    var toolbarButton = anchorElement || (editor && editor.toolbarElements ? editor.toolbarElements["table-grid"] : null);
    if (!picker || !toolbarButton) {
        return;
    }
    if (!picker.hidden && activeTableEditor === editor) {
        closeTablePicker();
        return;
    }
    closeColorPicker();
    closeEmojiPicker();
    closeToolbarHoverMenu();
    positionPicker(picker, toolbarButton);
    activeTableEditor = editor;
}

function openColorPicker(editor, anchorElement, options) {
    var picker = createColorPicker();
    var pickerMode = options && options.mode === "selection" ? "selection" : "toolbar";
    var toolbarButton = anchorElement || (editor && editor.toolbarElements ? editor.toolbarElements["text-color"] : null);
    if (!picker || (pickerMode !== "selection" && !toolbarButton)) {
        return;
    }
    if (!picker.hidden && activeColorEditor === editor) {
        closeColorPicker();
        return;
    }
    closeEmojiPicker(true);
    activeColorSelectionState = cloneSelectionState(editor === activeContextToolbarEditor ? editorContextSelectionState : captureEditorSelection(editor));
    activeColorEditor = editor;
    activeColorPickerMode = pickerMode;
    if (pickerMode === "selection" && positionPickerAtSelection(picker, editor, activeColorSelectionState)) {
        return;
    }
    if (toolbarButton) {
        positionPicker(picker, toolbarButton);
    }
}

function openEmojiPicker(editor, anchorElement, options) {
    var picker = createEmojiPicker();
    var pickerMode = options && options.mode === "selection" ? "selection" : "toolbar";
    var toolbarButton = anchorElement || (editor && editor.toolbarElements ? editor.toolbarElements["emoji-picker"] : null);
    if (!picker || (pickerMode !== "selection" && !toolbarButton)) {
        return;
    }
    if (!picker.hidden && activeEmojiEditor === editor) {
        closeEmojiPicker();
        return;
    }
    closeColorPicker(true);
    activeEmojiSelectionState = cloneSelectionState(editor === activeContextToolbarEditor ? editorContextSelectionState : captureEditorSelection(editor));
    activeEmojiEditor = editor;
    activeEmojiPickerMode = pickerMode;
    if (pickerMode === "selection" && positionPickerAtSelection(picker, editor, activeEmojiSelectionState)) {
        return;
    }
    if (toolbarButton) {
        positionPicker(picker, toolbarButton);
    }
}

function repositionActiveContextPickers() {
    if (colorPicker && !colorPicker.hidden && activeColorEditor && activeColorPickerMode === "selection") {
        positionPickerAtSelection(colorPicker, activeColorEditor, activeColorSelectionState);
    }
    if (emojiPicker && !emojiPicker.hidden && activeEmojiEditor && activeEmojiPickerMode === "selection") {
        positionPickerAtSelection(emojiPicker, activeEmojiEditor, activeEmojiSelectionState);
    }
}

function getMarkdownUploadUrl() {
    if (activeImageEditor && activeImageEditor.element) {
        return activeImageEditor.element.getAttribute("data-upload-url") || "";
    }
    return markdownEditors.length ? markdownEditors[0].element.getAttribute("data-upload-url") || "" : "";
}

function ensureMarkdownTableImportInput() {
    if (markdownTableImportInput) {
        return markdownTableImportInput;
    }
    markdownTableImportInput = document.createElement("input");
    markdownTableImportInput.type = "file";
    markdownTableImportInput.hidden = true;
    markdownTableImportInput.addEventListener("change", function () {
        var selectedFile = this.files && this.files[0] ? this.files[0] : null;
        var editor = activeTableImportEditor;
        var delimiter = activeTableImportDelimiter;
        if (!selectedFile || !editor) {
            this.value = "";
            activeTableImportEditor = null;
            return;
        }
        selectedFile.text().then(function (content) {
            var rows = parseDelimitedTable(content, delimiter);
            restoreActiveContextEditorSelection(editor);
            if (!rows.length) {
                openTableImportError(editor, getEditorString(editor, "data-table-import-empty-message", "The selected file does not contain any table data."));
                return;
            }
            openTableDialog(editor, rows.length, rows[0].length, rows);
        }).catch(function () {
            openTableImportError(editor, getEditorString(editor, "data-table-import-error-message", "Please choose a valid CSV or TSV file and try again."));
        }).finally(function () {
            markdownTableImportInput.value = "";
            activeTableImportEditor = null;
        });
    });
    document.body.appendChild(markdownTableImportInput);
    return markdownTableImportInput;
}

function ensureMarkdownImageInput() {
    if (markdownImageInput) {
        return markdownImageInput;
    }
    markdownImageInput = document.createElement("input");
    markdownImageInput.type = "file";
    markdownImageInput.accept = "image/*";
    markdownImageInput.hidden = true;
    markdownImageInput.addEventListener("change", function () {
        var selectedFile = this.files && this.files[0] ? this.files[0] : null;
        var uploadUrl = getMarkdownUploadUrl();
        var csrfToken = getCsrfToken();
        var editor = activeImageEditor;
        var requestBody = null;

        if (!selectedFile || !uploadUrl || !editor || !editor.codemirror) {
            this.value = "";
            activeImageEditor = null;
            return;
        }

        requestBody = new FormData();
        requestBody.append("image", selectedFile);
        if (csrfToken) {
            requestBody.append("csrfmiddlewaretoken", csrfToken);
        }

        fetch(uploadUrl, {
            method: "POST",
            headers: { "X-Requested-With": "XMLHttpRequest" },
            body: requestBody,
            credentials: "same-origin"
        })
            .then(function (response) {
                return response.json().catch(function () {
                    return { success: 0, message: "Image upload failed." };
                }).then(function (data) {
                    return {
                        ok: response.ok && data.success === 1 && data.file && data.file.url,
                        message: data.message || "",
                        url: data.file && data.file.url ? data.file.url : ""
                    };
                });
            })
            .then(function (result) {
                var imageLabel = "";
                if (!result.ok) {
                    openModal({
                        tone: "error",
                        kicker: "Image upload",
                        title: "Image upload failed",
                        message: result.message || "Please try again.",
                        confirmText: "OK"
                    });
                    return;
                }
                imageLabel = selectedFile.name.replace(/\.[^.]+$/, "") || "image";
                editor.codemirror.replaceSelection("![" + imageLabel + "](" + result.url + ")");
                editor.codemirror.focus();
            })
            .catch(function () {
                openModal({
                    tone: "error",
                    kicker: "Image upload",
                    title: "Image upload failed",
                    message: "Please try again.",
                    confirmText: "OK"
                });
            })
            .finally(function () {
                markdownImageInput.value = "";
                activeImageEditor = null;
            });
    });
    document.body.appendChild(markdownImageInput);
    return markdownImageInput;
}

function openMarkdownImagePicker(editor) {
    openImageDialog(editor);
}

function openMarkdownImageUpload(editor) {
    var imageInput = ensureMarkdownImageInput();
    if (!imageInput) {
        return;
    }
    restoreActiveContextEditorSelection(editor);
    activeImageEditor = editor;
    imageInput.click();
}

function openMarkdownTableImport(editor, delimiter, accept) {
    var importInput = ensureMarkdownTableImportInput();
    if (!importInput) {
        return;
    }
    restoreActiveContextEditorSelection(editor);
    activeTableImportEditor = editor;
    activeTableImportDelimiter = delimiter === "\t" ? "\t" : ",";
    activeTableImportAccept = accept || ".csv,text/csv";
    importInput.accept = activeTableImportAccept;
    importInput.click();
}

function attachEditorHoverMenus(editor) {
    bindToolbarHoverMenu(editor, "link", [
        {
            label: getEditorString(editor, "data-link-reference-label", "Reference internal post"),
            iconClass: "fa-solid fa-file-lines",
            onClick: function () {
                openInternalReferenceDialog(editor);
            }
        }
    ]);

    bindToolbarHoverMenu(editor, "image-upload", [
        {
            label: getEditorString(editor, "data-image-upload-label", "Upload image"),
            iconClass: "fa-solid fa-cloud-arrow-up",
            onClick: function () {
                openMarkdownImageUpload(editor);
            }
        }
    ]);

    bindToolbarHoverMenu(editor, "table-grid", [
        buildTableImportAction(editor, ",", "data-table-import-csv-label", "Import from .csv", "csv", ".csv,text/csv"),
        buildTableImportAction(editor, "\t", "data-table-import-tsv-label", "Import from .tsv", "tsv", ".tsv,text/tab-separated-values,text/plain")
    ]);
}

function openEditorContextToolbar(event, editor) {
    var menu = ensureEditorContextToolbar();
    var actions = [];
    if (!menu || !editor || !editor.codemirror) {
        return;
    }
    actions = [
        {
            label: getEditorString(editor, "data-link-title", "Insert link"),
            iconClass: "fa-solid fa-link",
            onClick: function () {
                restoreActiveContextEditorSelection(editor);
                openLinkDialog(editor);
            }
        },
        {
            label: getEditorString(editor, "data-link-reference-label", "Reference internal post"),
            iconClass: "fa-solid fa-file-lines",
            onClick: function () {
                restoreActiveContextEditorSelection(editor);
                openInternalReferenceDialog(editor);
            }
        },
        {
            type: "separator"
        },
        {
            label: getEditorString(editor, "data-image-title", "Insert image"),
            iconClass: "fa-solid fa-image",
            onClick: function () {
                restoreActiveContextEditorSelection(editor);
                openImageDialog(editor);
            }
        },
        {
            label: getEditorString(editor, "data-image-upload-label", "Upload image"),
            iconClass: "fa-solid fa-cloud-arrow-up",
            onClick: function () {
                restoreActiveContextEditorSelection(editor);
                openMarkdownImageUpload(editor);
            }
        },
        {
            type: "separator"
        },
        {
            label: getEditorString(editor, "data-table-title", "Insert table"),
            iconClass: "fa-solid fa-table",
            onClick: function () {
                restoreActiveContextEditorSelection(editor);
                openTableDialog(editor, 3, 3);
            }
        },
        {
            label: getEditorString(editor, "data-table-import-csv-label", "Import from .csv"),
            iconText: "csv",
            onClick: function () {
                restoreActiveContextEditorSelection(editor);
                openMarkdownTableImport(editor, ",", ".csv,text/csv");
            }
        },
        {
            label: getEditorString(editor, "data-table-import-tsv-label", "Import from .tsv"),
            iconText: "tsv",
            onClick: function () {
                restoreActiveContextEditorSelection(editor);
                openMarkdownTableImport(editor, "\t", ".tsv,text/tab-separated-values,text/plain");
            }
        },
        {
            type: "separator"
        },
        {
            label: "Text color",
            iconClass: "fa-solid fa-palette",
            preserveContextSelection: true,
            onClick: function (trigger) {
                restoreActiveContextEditorSelection(editor);
                openColorPicker(editor, trigger, { mode: "selection" });
            }
        },
        {
            label: "Insert emoji",
            iconClass: "fa-solid fa-face-smile",
            preserveContextSelection: true,
            onClick: function (trigger) {
                restoreActiveContextEditorSelection(editor);
                openEmojiPicker(editor, trigger, { mode: "selection" });
            }
        }
    ];

    event.preventDefault();
    event.stopPropagation();
    closeTableContextMenu();
    closeTablePicker();
    closeToolbarHoverMenu();
    closeColorPicker();
    closeEmojiPicker();

    menu.innerHTML = "";
    activeContextToolbarEditor = editor;
    editorContextSelectionState = captureEditorSelection(editor);
    actions.forEach(function (action) {
        if (action.type === "separator") {
            menu.appendChild(createMenuSeparatorNode("editor-context-toolbar-separator"));
            return;
        }
        var button = document.createElement("button");
        var icon = createMenuIconNode(action, "editor-context-toolbar-icon");
        var label = document.createElement("span");

        button.type = "button";
        button.className = "editor-context-toolbar-item";
        button.setAttribute("aria-label", action.label || "");
        button.setAttribute("title", action.label || "");
        button.addEventListener("click", function (clickEvent) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            if (typeof action.onClick === "function") {
                action.onClick(button);
            }
            closeEditorContextToolbar(Boolean(action.preserveContextSelection));
        });
        label.className = "editor-context-toolbar-label";
        label.textContent = action.label || "";
        button.appendChild(icon);
        button.appendChild(label);
        menu.appendChild(button);
    });
    menu.hidden = false;
    positionContextMenu(menu, event);
}

function requestRenderedMarkdown(previewElement, plainText, previewUrl, fallbackRenderer) {
    var requestId = 0;
    var csrfToken = getCsrfToken();
    var body = null;
    if (!previewElement || !previewUrl || !csrfToken) {
        previewElement.innerHTML = renderMarkdownPreviewFallback(plainText, fallbackRenderer);
        enhanceMarkdownContainer(previewElement);
        return;
    }
    requestId = markdownPreviewRequestId + 1;
    markdownPreviewRequestId = requestId;
    previewElement.setAttribute("data-markdown-preview-request-id", String(requestId));
    body = new URLSearchParams();
    body.append("content", plainText || "");
    body.append("csrfmiddlewaretoken", csrfToken);

    fetch(previewUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        },
        body: body.toString(),
        credentials: "same-origin"
    }).then(function (response) {
        return response.json().catch(function () {
            return { ok: false, html: "" };
        }).then(function (data) {
            return { ok: response.ok && data.ok, html: data.html || "" };
        });
    }).then(function (result) {
        if (previewElement.getAttribute("data-markdown-preview-request-id") !== String(requestId)) {
            return;
        }
        if (!result.ok) {
            throw new Error("Markdown preview request failed.");
        }
        previewElement.innerHTML = result.html;
        enhanceMarkdownContainer(previewElement);
    }).catch(function () {
        if (previewElement.getAttribute("data-markdown-preview-request-id") !== String(requestId)) {
            return;
        }
        previewElement.innerHTML = renderMarkdownPreviewFallback(plainText, fallbackRenderer);
        enhanceMarkdownContainer(previewElement);
    });
}

function initializeMarkdownEditor(node) {
    var editor = null;
    var previewUrl = "";
    var previewTimer = 0;
    var initialValue = "";
    var editorSurface = null;
    var postEditorForm = document.querySelector("[data-post-editor-form]");

    if (!node || !window.EasyMDE) {
        return null;
    }
    previewUrl = node.getAttribute("data-preview-url") || "";
    initialValue = node.value || "";

    editor = new EasyMDE({
        element: node,
        autoDownloadFontAwesome: false,
        forceSync: true,
        spellChecker: false,
        sideBySideFullscreen: false,
        status: ["lines", "words"],
        previewClass: ["blog-markdown-content"],
        previewRender: function (plainText, preview) {
            var fallbackHtml = renderMarkdownPreviewFallback(plainText, editor.markdown.bind(editor));
            if (!preview) {
                return fallbackHtml;
            }
            preview.innerHTML = fallbackHtml;
            enhanceMarkdownContainer(preview);
            if (previewTimer) {
                window.clearTimeout(previewTimer);
            }
            previewTimer = window.setTimeout(function () {
                requestRenderedMarkdown(preview, plainText, previewUrl, editor.markdown.bind(editor));
            }, 220);
            return preview.innerHTML;
        },
        toolbar: [
            "bold",
            "italic",
            "heading",
            {
                name: "text-color",
                action: openColorPicker,
                className: "fa fa-palette no-disable",
                title: "Text Color"
            },
            "|",
            "quote",
            "unordered-list",
            "ordered-list",
            {
                name: "table-grid",
                action: openTablePicker,
                className: "fa fa-table no-disable",
                title: "Insert Table"
            },
            "|",
            {
                name: "link",
                action: openLinkDialog,
                className: "fa fa-link no-disable",
                title: "Insert Link"
            },
            {
                name: "image-upload",
                action: openMarkdownImagePicker,
                className: "fa fa-image no-disable",
                title: "Insert Image"
            },
            {
                name: "emoji-picker",
                action: openEmojiPicker,
                className: "fa fa-face-smile no-disable",
                title: "Insert Emoji"
            },
            "code",
            "|",
            "side-by-side",
            "guide"
        ],
        renderingConfig: {
            singleLineBreaks: false,
            codeSyntaxHighlighting: false
        }
    });

    markdownEditors.push(editor);
    if (editor.codemirror && editor.codemirror.getValue() !== initialValue) {
        editor.codemirror.setValue(initialValue);
    }
    if (postEditorForm && postEditorForm.contains(node)) {
        postMarkdownEditor = editor;
    }
    attachEditorHoverMenus(editor);
    editorSurface = editor.codemirror && typeof editor.codemirror.getWrapperElement === "function" ? editor.codemirror.getWrapperElement() : null;
    if (editorSurface) {
        editorSurface.addEventListener("contextmenu", function (event) {
            openEditorContextToolbar(event, editor);
        });
    }
    return editor;
}

function findMarkdownEditorByTextarea(textarea) {
    if (!textarea) {
        return null;
    }
    return markdownEditors.find(function (candidate) {
        return candidate.element === textarea;
    }) || null;
}

export function syncEditorFromTextarea(textarea) {
    var editorInstance = findMarkdownEditorByTextarea(textarea);
    if (!editorInstance || !editorInstance.codemirror) {
        return null;
    }
    if (editorInstance.codemirror.getValue() !== textarea.value) {
        editorInstance.codemirror.setValue(textarea.value || "");
    }
    editorInstance.codemirror.refresh();
    return editorInstance;
}

function initMarkdownEditors() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-markdown-editor='true']"), function (node) {
        if (node.getAttribute("data-markdown-editor-initialized") === "true") {
            return;
        }
        node.setAttribute("data-markdown-editor-initialized", "true");
        initializeMarkdownEditor(node);
    });

    window.setTimeout(function () {
        Array.prototype.forEach.call(document.querySelectorAll(".editor-preview, .editor-preview-side, .blog-markdown-content"), function (preview) {
            enhanceMarkdownContainer(preview);
        });
    }, 0);
}

function initEditorGlobalCleanup() {
    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") {
            return;
        }
        closeTableContextMenu();
        closeEditorContextToolbar();
        closeTablePicker();
        closeToolbarHoverMenu();
        closeColorPicker();
        closeEmojiPicker();
        closeActionMenu();
    });

    document.addEventListener("click", function (event) {
        if (tableContextMenu && !tableContextMenu.hidden && !tableContextMenu.contains(event.target)) {
            closeTableContextMenu();
        }
        if (editorContextToolbar && !editorContextToolbar.hidden && !editorContextToolbar.contains(event.target)) {
            closeEditorContextToolbar();
        }
        if (tablePicker && !tablePicker.hidden && !tablePicker.contains(event.target) && !isPickerButtonClick(event.target, activeTableEditor, "table-grid")) {
            closeTablePicker();
        }
        if (toolbarHoverMenu && !toolbarHoverMenu.hidden && !toolbarHoverMenu.contains(event.target) && !event.target.closest(".editor-toolbar")) {
            closeToolbarHoverMenu();
        }
        if (colorPicker && !colorPicker.hidden && !colorPicker.contains(event.target) && !isPickerButtonClick(event.target, activeColorEditor, "text-color")) {
            closeColorPicker();
        }
        if (emojiPicker && !emojiPicker.hidden && !emojiPicker.contains(event.target) && !isPickerButtonClick(event.target, activeEmojiEditor, "emoji-picker")) {
            closeEmojiPicker();
        }
    });

    window.addEventListener("resize", function () {
        closeTableContextMenu();
        closeEditorContextToolbar();
        closeTablePicker();
        closeToolbarHoverMenu();
        repositionActiveContextPickers();
        if (colorPicker && !colorPicker.hidden && activeColorPickerMode !== "selection") {
            closeColorPicker();
        }
        if (emojiPicker && !emojiPicker.hidden && activeEmojiPickerMode !== "selection") {
            closeEmojiPicker();
        }
    });
    window.addEventListener("scroll", function () {
        closeTableContextMenu();
        closeEditorContextToolbar();
        closeTablePicker();
        closeToolbarHoverMenu();
        repositionActiveContextPickers();
        if (colorPicker && !colorPicker.hidden && activeColorPickerMode !== "selection") {
            closeColorPicker();
        }
        if (emojiPicker && !emojiPicker.hidden && activeEmojiPickerMode !== "selection") {
            closeEmojiPicker();
        }
    }, true);
}

var editorInitialized = false;

export function initBlogEditor() {
    if (editorInitialized) {
        return;
    }
    editorInitialized = true;
    initMarkdownEditors();
    initEditorGlobalCleanup();
}
