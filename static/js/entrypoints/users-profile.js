import { onReady } from "../core/app.js";
import { initUsersAuth } from "../apps/users/auth.js";
import { initBlogManage } from "../apps/blog/manage.js";

function initProfileUserGroupTable(scope) {
    var tableWrap = scope.querySelector(".profile-user-group-table-wrap");
    if (!tableWrap) {
        return;
    }
    var currentHeaderCell = tableWrap.querySelector("thead th.is-current");
    var stickyHeaderCell = tableWrap.querySelector("thead th:first-child");
    if (!currentHeaderCell || !stickyHeaderCell) {
        return;
    }

    var stickyWidth = stickyHeaderCell.getBoundingClientRect().width;
    var currentOffsetLeft = currentHeaderCell.offsetLeft;
    var currentWidth = currentHeaderCell.getBoundingClientRect().width;
    var targetScrollLeft = currentOffsetLeft - stickyWidth - ((tableWrap.clientWidth - stickyWidth - currentWidth) / 2);

    tableWrap.scrollLeft = Math.max(Math.round(targetScrollLeft), 0);
}

onReady(function () {
    initUsersAuth(document);
    initBlogManage();
    initProfileUserGroupTable(document);
});
