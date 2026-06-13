import { onReady, openModal, closeModal } from "../core/app.js";
import { initBlogShared } from "../apps/blog/shared.js";
import { initBlogManage } from "../apps/blog/manage.js";

onReady(function () {
    initBlogShared();
    initBlogManage();

    var chapterWorkbench = document.querySelector("[data-book-chapter-workbench][data-profile-book-mode]");
    if (!chapterWorkbench) return;

    var bookEditorForm = chapterWorkbench.closest("[data-book-editor-form]");
    if (!bookEditorForm) return;

    var addPostsButton = bookEditorForm.querySelector("[data-book-add-posts]");
    if (addPostsButton) {
        var newButton = addPostsButton.cloneNode(true);
        addPostsButton.parentNode.replaceChild(newButton, addPostsButton);
        newButton.addEventListener("click", function () {
            openProfilePostPicker(bookEditorForm, chapterWorkbench);
        });
    }
});

function getBookEditorString(el, name, fallback) {
    var value = el ? el.getAttribute(name) : "";
    return value || fallback;
}

function openProfilePostPicker(bookEditorForm, chapterWorkbench) {
    var bookEditorApi = bookEditorForm.__bookEditorApi || null;
    var searchUrl = getBookEditorString(chapterWorkbench, "data-reference-search-url", "");
    var container = document.createElement("div");
    var input = document.createElement("input");
    var results = document.createElement("div");
    var resultGrid = document.createElement("div");
    var pagination = document.createElement("div");
    var paginationStatus = document.createElement("div");
    var paginationActions = document.createElement("div");
    var previousButton = document.createElement("button");
    var nextButton = document.createElement("button");
    var empty = document.createElement("p");
    var selectedPostId = null;
    var requestId = 0;
    var activePage = 1;
    var latestQuery = "";
    var postItemCache = Object.create(null);
    var selectedIds = collectSelectedPostIds(bookEditorForm);
    var selectedMap = Object.create(null);
    selectedIds.forEach(function (id) { selectedMap[String(id)] = true; });

    if (!searchUrl) return;

    container.className = "editor-modal-form chapter-post-picker";
    input.className = "input-control";
    input.placeholder = getBookEditorString(chapterWorkbench, "data-chapter-search-placeholder", "Search posts");
    results.className = "chapter-post-picker-results";
    resultGrid.className = "post-grid editor-reference-grid chapter-post-picker-grid";
    pagination.className = "editor-dialog-pagination pagination-panel";
    paginationStatus.className = "pagination-status";
    paginationActions.className = "pagination-actions";
    previousButton.type = "button";
    previousButton.className = "secondary-button pagination-button";
    previousButton.textContent = "Previous";
    nextButton.type = "button";
    nextButton.className = "secondary-button pagination-button";
    nextButton.textContent = "Next";
    empty.className = "field-help";
    empty.textContent = getBookEditorString(chapterWorkbench, "data-chapter-no-posts-label", "No posts found.");
    paginationActions.appendChild(previousButton);
    paginationActions.appendChild(nextButton);
    pagination.appendChild(paginationStatus);
    pagination.appendChild(paginationActions);
    results.appendChild(resultGrid);
    container.appendChild(input);
    container.appendChild(results);
    container.appendChild(pagination);

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

    function renderItems(items) {
        resultGrid.innerHTML = "";
        postItemCache = Object.create(null);
        results.classList.toggle("is-empty", !items.length);
        if (!items.length) {
            if (!results.contains(empty)) results.appendChild(empty);
            return;
        }
        if (results.contains(empty)) results.removeChild(empty);

        items.forEach(function (item) {
            var itemId = String(item.id);
            postItemCache[itemId] = item;

            var wrapper = document.createElement("div");
            wrapper.innerHTML = item.html || "";
            var card = wrapper.firstElementChild;
            if (!card) return;

            var isAlreadyAdded = Boolean(selectedMap[itemId]);

            var toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "chapter-post-picker-select" + (selectedPostId === itemId ? " is-selected" : "") + (isAlreadyAdded ? " is-disabled" : "");
            toggle.textContent = isAlreadyAdded
                ? getBookEditorString(chapterWorkbench, "data-chapter-added-label", "Added")
                : (selectedPostId === itemId
                    ? getBookEditorString(chapterWorkbench, "data-chapter-selected-label", "Selected")
                    : getBookEditorString(chapterWorkbench, "data-chapter-select-label", "Select"));
            toggle.disabled = isAlreadyAdded;

            toggle.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (isAlreadyAdded) return;

                if (selectedPostId === itemId) {
                    selectedPostId = null;
                    toggle.classList.remove("is-selected");
                    toggle.textContent = getBookEditorString(chapterWorkbench, "data-chapter-select-label", "Select");
                    return;
                }

                if (selectedPostId) {
                    var prevToggles = resultGrid.querySelectorAll(".chapter-post-picker-select.is-selected");
                    Array.prototype.forEach.call(prevToggles, function (t) {
                        t.classList.remove("is-selected");
                        t.textContent = getBookEditorString(chapterWorkbench, "data-chapter-select-label", "Select");
                    });
                }

                selectedPostId = itemId;
                toggle.classList.add("is-selected");
                toggle.textContent = getBookEditorString(chapterWorkbench, "data-chapter-selected-label", "Selected");
            });

            var trigger = wrapper.querySelector("[data-post-card-select]");
            if (trigger) {
                trigger.addEventListener("click", function (event) {
                    event.preventDefault();
                    toggle.click();
                });
            }

            card.classList.add("chapter-post-picker-card");
            card.appendChild(toggle);
            resultGrid.appendChild(card);
        });
    }

    function fetchResults(query, page) {
        requestId += 1;
        var currentRequestId = requestId;
        var queryText = typeof query === "string" ? query : "";
        var targetPage = page || 1;
        latestQuery = queryText;

        fetch(searchUrl + "?q=" + encodeURIComponent(queryText) + "&page=" + encodeURIComponent(String(targetPage)), { credentials: "same-origin" })
            .then(function (response) {
                return response.json().catch(function () { return { ok: false, items: [], pagination: null }; });
            })
            .then(function (payload) {
                if (currentRequestId !== requestId) return;
                var items = payload.ok ? (payload.items || []) : [];
                renderItems(items);
                updatePagination(payload.ok ? payload.pagination : null, items.length > 0);
            })
            .catch(function () {
                if (currentRequestId !== requestId) return;
                renderItems([]);
                updatePagination(null, false);
            });
    }

    function doAddPost(postItem) {
        if (bookEditorApi && typeof bookEditorApi.addPostItem === "function") {
            bookEditorApi.addPostItem(postItem);
        }
    }

    input.addEventListener("input", function () {
        fetchResults(input.value, 1);
    });
    previousButton.addEventListener("click", function () {
        if (previousButton.disabled || activePage <= 1) return;
        fetchResults(latestQuery, activePage - 1);
    });
    nextButton.addEventListener("click", function () {
        if (nextButton.disabled) return;
        fetchResults(latestQuery, activePage + 1);
    });

    openModal({
        kicker: getBookEditorString(chapterWorkbench, "data-chapter-kicker", "Chapters"),
        title: getBookEditorString(chapterWorkbench, "data-chapter-add-posts-label", "Add article"),
        contentNode: container,
        cancelText: getBookEditorString(chapterWorkbench, "data-chapter-cancel-label", "Cancel"),
        confirmText: getBookEditorString(chapterWorkbench, "data-chapter-add-selected-label", "Add selected"),
        keepOpenOnConfirm: true,
        onConfirm: function () {
            if (!selectedPostId) return;
            var selectedItem = postItemCache[String(selectedPostId)];
            if (!selectedItem) return;
            doAddPost(selectedItem);
            closeModal();
        },
        dialogClass: "is-wide-dialog"
    });

    fetchResults("", 1);
    window.setTimeout(function () {
        input.focus();
    }, 0);
}

function collectSelectedPostIds(bookEditorForm) {
    var structureInput = bookEditorForm ? bookEditorForm.querySelector("#id_structure") : null;
    var structure = [];
    var ids = [];

    try {
        structure = JSON.parse((structureInput && structureInput.value) || "[]") || [];
    } catch (_error) {
        structure = [];
    }

    walkStructure(structure, ids);
    return ids;
}

function walkStructure(nodes, ids) {
    (nodes || []).forEach(function (node) {
        if (!node || typeof node !== "object") {
            return;
        }
        if (node.type === "post" && node.post_id != null) {
            ids.push(String(node.post_id));
            return;
        }
        if (node.type === "group") {
            walkStructure(node.children || [], ids);
        }
    });
}
