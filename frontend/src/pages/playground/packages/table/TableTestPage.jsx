import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import { Modal } from "../../../../packages/modal";
import { Table, useTableController } from "../../../../packages/table";
import "./TableTestPage.css";

const ROLES = ["Superuser", "Staff", "Editor", "Author", "Reviewer", "Member"];
const STATUS = ["Active", "Muted", "Pending", "Disabled"];
const TEAMS = ["Core", "Platform", "Content", "Growth", "Support", "Archive"];
const CITIES = [
  "Hangzhou",
  "Shanghai",
  "Beijing",
  "Shenzhen",
  "Chengdu",
  "Wuhan",
];
const COLORWAYS = ["Peach", "Lilac", "Sky", "Mint", "Rose", "Amber"];

const baseDescriptions = [
  "Maintains moderation queues, release checklists, and internal audit notes.",
  "Owns a long-running knowledge base with dense markdown tables and embedded references.",
  "Frequently leaves very long feedback that is ideal for wrap and ellipsis testing in management tables.",
  "Coordinates uploads, comments, and community response workflows across several time zones.",
  "Handles access reviews, attachment triage, and reward reconciliation for high-volume weeks.",
  "Tracks archival work, historical migrations, and imported content cleanup tasks.",
];

const wideColumnsConfig = [
  "Primary role",
  "Secondary role",
  "Team",
  "City",
  "Colorway",
  "Score",
  "Articles",
  "Comments",
  "Attachments",
  "Latest note",
];

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function translateTableLabel(overrides) {
  return (key, fallback) => overrides[key] ?? fallback;
}

function formatDate(offset) {
  const date = new Date(Date.now() - offset * 1000 * 60 * 73);
  return date.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createMockRows() {
  return Array.from({ length: 72 }, (_, index) => {
    const role = ROLES[index % ROLES.length];
    const status = STATUS[index % STATUS.length];
    const team = TEAMS[index % TEAMS.length];
    const city = CITIES[index % CITIES.length];
    const colorway = COLORWAYS[index % COLORWAYS.length];
    const score = 420 + index * 17;
    const articleCount = (index * 3) % 27;
    const commentCount = (index * 7) % 66;
    const attachmentCount = (index * 5) % 18;
    const description = `${baseDescriptions[index % baseDescriptions.length]} Focus area ${index + 1} also contains a preview sentence for horizontal scroll observation.`;

    return {
      id: `row-${index + 1}`,
      displayName: `Aurora Member ${String(index + 1).padStart(2, "0")}`,
      email: `member${String(index + 1).padStart(2, "0")}@wacmk.test`,
      role,
      status,
      team,
      city,
      colorway,
      score,
      articleCount,
      commentCount,
      attachmentCount,
      updatedAt: formatDate(index + 1),
      description,
      latestNote: `Checkpoint ${index + 1}: ${description}`,
    };
  });
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), "zh-CN", {
    sensitivity: "base",
  });
}

function compareNumber(left, right) {
  return Number(left || 0) - Number(right || 0);
}

function sortRows(rows, sortKey, sortDirection) {
  if (!sortKey || !sortDirection) {
    return rows;
  }

  const sorted = [...rows];
  sorted.sort((left, right) => {
    let value = 0;

    if (
      sortKey === "displayName" ||
      sortKey === "email" ||
      sortKey === "role" ||
      sortKey === "status" ||
      sortKey === "updatedAt"
    ) {
      value = compareText(left[sortKey], right[sortKey]);
    } else if (
      sortKey === "score" ||
      sortKey === "articleCount" ||
      sortKey === "commentCount"
    ) {
      value = compareNumber(left[sortKey], right[sortKey]);
    }

    if (value === 0) {
      value = compareText(left.displayName, right.displayName);
    }

    return sortDirection === "asc" ? value : value * -1;
  });

  return sorted;
}

function filterRows(rows, query) {
  const normalized = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return rows;
  }

  return rows.filter((row) =>
    [
      row.displayName,
      row.email,
      row.role,
      row.status,
      row.team,
      row.city,
      row.description,
      row.latestNote,
    ].some((value) => String(value).toLowerCase().includes(normalized)),
  );
}

function getPagedRows(rows, page, pageSize) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function buildWideRows() {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `wide-${index + 1}`,
    title: `Dataset ${index + 1}`,
    values: [
      ROLES[index % ROLES.length],
      ROLES[(index + 2) % ROLES.length],
      TEAMS[(index + 1) % TEAMS.length],
      CITIES[(index + 3) % CITIES.length],
      COLORWAYS[(index + 4) % COLORWAYS.length],
      1200 + index * 33,
      12 + index,
      34 + index * 2,
      4 + index,
      `This row intentionally keeps a long trailing note for horizontal scroll verification ${index + 1}.`,
    ],
  }));
}

export default function TableTestPage() {
  const navigate = useNavigate();
  const [scenarioMode, setScenarioMode] = React.useState("normal");
  const [activityLog, setActivityLog] = React.useState([
    "右键列表行、切换 page size、调整排序或搜索关键词，观察 table 包的联动表现。",
  ]);
  const [previewRow, setPreviewRow] = React.useState(null);
  const [deleteRow, setDeleteRow] = React.useState(null);
  const mockRows = React.useMemo(() => createMockRows(), []);
  const wideRows = React.useMemo(() => buildWideRows(), []);

  function pushLog(message) {
    setActivityLog((current) => [message, ...current].slice(0, 9));
  }

  const fetchData = React.useCallback(
    async ({ query, page, pageSize, sortKey, sortDirection }) => {
      await wait(280);

      if (scenarioMode === "error") {
        throw new Error(
          "Simulated request failed. This checks the error slot rendering path.",
        );
      }

      if (scenarioMode === "empty") {
        return {
          items: [],
          total: 0,
        };
      }

      const filtered = filterRows(mockRows, query);
      const sorted = sortRows(filtered, sortKey, sortDirection);

      return {
        items: getPagedRows(sorted, page, pageSize),
        total: sorted.length,
      };
    },
    [mockRows, scenarioMode],
  );

  const controller = useTableController({
    initialPageSize: 10,
    initialSort: { key: "updatedAt", direction: "desc" },
    fetchData,
  });

  React.useEffect(() => {
    void controller.refresh();
  }, [controller.refresh, scenarioMode]);

  const playgroundColumns = React.useMemo(
    () => [
      {
        key: "displayName",
        title: "User",
        canOrder: true,
        defaultOrder: true,
        minWidth: 210,
        render: (row) => (
          <div className="table-test-user-cell">
            <strong>{row.displayName}</strong>
            <span>{row.team}</span>
          </div>
        ),
      },
      {
        key: "email",
        title: "Email",
        canOrder: true,
        minWidth: 220,
        render: (row) => row.email,
      },
      {
        key: "role",
        title: "Role",
        canOrder: true,
        minWidth: 130,
        render: (row) => <span className="table-test-pill">{row.role}</span>,
      },
      {
        key: "status",
        title: "State",
        canOrder: true,
        minWidth: 120,
        render: (row) => (
          <span
            className={`table-test-pill table-test-pill--${row.status.toLowerCase()}`}
          >
            {row.status}
          </span>
        ),
      },
      {
        key: "score",
        title: "Score",
        canOrder: true,
        align: "right",
        minWidth: 100,
        render: (row) => row.score.toLocaleString("zh-CN"),
      },
      {
        key: "commentCount",
        title: "Comments",
        canOrder: true,
        align: "right",
        minWidth: 110,
        render: (row) => row.commentCount,
      },
      {
        key: "updatedAt",
        title: "Updated",
        canOrder: true,
        minWidth: 170,
        render: (row) => row.updatedAt,
      },
      {
        key: "description",
        title: "Preview",
        minWidth: 360,
        ellipsis: true,
        render: (row) => row.description,
      },
    ],
    [],
  );

  const wideColumns = React.useMemo(
    () => [
      {
        key: "title",
        title: "Dataset",
        minWidth: 180,
        render: (row) => <strong>{row.title}</strong>,
      },
      ...wideColumnsConfig.map((label, index) => ({
        key: `column-${index}`,
        title: label,
        minWidth: index === wideColumnsConfig.length - 1 ? 340 : 140,
        ellipsis: index === wideColumnsConfig.length - 1,
        render: (row) => row.values[index],
      })),
    ],
    [],
  );

  const stateGalleryColumns = React.useMemo(
    () => [
      {
        key: "name",
        title: "Name",
        minWidth: 160,
        render: (row) => row.name,
      },
      {
        key: "detail",
        title: "Detail",
        minWidth: 320,
        wrap: true,
        render: (row) => row.detail,
      },
    ],
    [],
  );

  const stateGalleryRows = React.useMemo(
    () => [
      {
        id: "state-1",
        name: "Ready item",
        detail:
          "This direct Table instance verifies presentational rendering without the controller hook.",
      },
      {
        id: "state-2",
        name: "Second item",
        detail:
          "The body keeps the same shell and styling even when the parent page drives state directly.",
      },
    ],
    [],
  );

  function getRowContextActions(row) {
    return [
      {
        group: 1,
        children: [
          {
            key: `${row.id}-preview`,
            label: `Preview ${row.displayName}`,
            onClick: () => {
              setPreviewRow(row);
              pushLog(`Preview row: ${row.displayName}`);
            },
          },
          {
            key: `${row.id}-refresh`,
            label: "Refresh current page",
            onClick: async () => {
              pushLog(`Manual refresh from row menu: ${row.displayName}`);
              await controller.refresh();
            },
          },
        ],
      },
      {
        group: 2,
        children: [
          {
            key: `${row.id}-status`,
            label: `Status: ${row.status}`,
            disabled: true,
            onClick: () => {},
          },
        ],
      },
      {
        group: 3,
        children: [
          {
            key: `${row.id}-delete`,
            label: `Delete ${row.displayName}`,
            danger: true,
            onClick: () => {
              setDeleteRow(row);
              pushLog(`Open delete confirm: ${row.displayName}`);
            },
          },
        ],
      },
    ];
  }

  return (
    <main className="table-test-page">
      <section className="table-test-hero">
        <div className="table-test-hero__copy">
          <p className="table-test-eyebrow">/test/frontend/packages/table</p>
          <h1>Table Package Playground</h1>
          <p className="table-test-lead">
            这里集中测试 `frontend/src/packages/table`
            的核心能力，包括控制器拉数、搜索回车、排序、分页、 page
            size、长内容横向滚动、右键菜单高亮，以及与
            `modal`、`context-actions` 的协作表现。
          </p>
        </div>
        <div className="table-test-hero__actions">
          <Button onClick={() => navigate("/home")}>返回首页</Button>
          <Button
            variant="secondary"
            onClick={() => controller.refresh()}
            loading={controller.loading}
          >
            刷新当前数据
          </Button>
        </div>
      </section>

      <section className="table-test-layout">
        <div className="table-test-main">
          <article className="table-test-card table-test-card--wide">
            <div className="table-test-card__header">
              <div>
                <h2>Controller Playground</h2>
                <p>
                  服务端风格的虚拟拉数场景。可搜索、排序、翻页、切 page
                  size，并通过右键菜单触发预览和危险操作。
                </p>
              </div>
              <div className="table-test-toggle-group">
                <Button
                  variant={scenarioMode === "normal" ? "primary" : "secondary"}
                  onClick={() => setScenarioMode("normal")}
                >
                  Normal
                </Button>
                <Button
                  variant={scenarioMode === "empty" ? "primary" : "secondary"}
                  onClick={() => setScenarioMode("empty")}
                >
                  Empty
                </Button>
                <Button
                  variant={scenarioMode === "error" ? "primary" : "secondary"}
                  onClick={() => setScenarioMode("error")}
                >
                  Error
                </Button>
              </div>
            </div>

            <Table
              columns={playgroundColumns}
              rows={controller.rows}
              rowKey={(row) => row.id}
              loading={controller.loading}
              error={
                controller.error ? (
                  <span>
                    {String(controller.error.message || controller.error)}
                  </span>
                ) : null
              }
              empty={
                <span>
                  虚拟结果集为空。这个场景用于验证空态布局和分页收起行为。
                </span>
              }
              searchText={controller.searchText}
              onSearchTextChange={controller.setSearchText}
              onSearchEnter={controller.submitSearch}
              searchPlaceholderText="Search users, roles, email, city, or notes..."
              sortKey={controller.sortKey}
              sortDirection={controller.sortDirection}
              onSortChange={controller.changeSort}
              page={controller.page}
              pageSize={controller.pageSize}
              total={controller.total}
              pageSizeOptions={[10, 20, 30, 50]}
              onPageChange={controller.changePage}
              onPageSizeChange={controller.changePageSize}
              translate={translateTableLabel({
                "table.searchButton": "Fetch",
                "table.loading": "Fetching virtual dataset...",
                "table.noData": "No rows match the current virtual query.",
                "table.pagination.pageSize": "Rows",
                "table.pagination.pageStatus": "Page {current} / {total}",
              })}
              getRowContextActions={getRowContextActions}
              searchChildren={
                <>
                  <Button
                    variant="secondary"
                    onClick={() => controller.refresh()}
                    loading={controller.loading}
                  >
                    Manual refresh
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => controller.setSearchText("staff")}
                  >
                    Preset: staff
                  </Button>
                </>
              }
            />
          </article>

          <article className="table-test-card table-test-card--wide">
            <div className="table-test-card__header">
              <h2>Wide Content And Horizontal Scroll</h2>
              <p>
                这一段直接验证 `width: max-content`、超宽列、ellipsis
                和横向滚动条表现，接近旧项目的管理列表体验。
              </p>
            </div>

            <Table
              columns={wideColumns}
              rows={wideRows}
              rowKey={(row) => row.id}
              translate={translateTableLabel({
                "table.noData": "No wide rows.",
              })}
            />
          </article>

          <article className="table-test-card table-test-card--wide">
            <div className="table-test-card__header">
              <div>
                <h2>Sticky First Column</h2>
                <p>
                  横向滚动时首列保持可见，参考旧项目个人设置用户组能力表的体验。
                </p>
              </div>
              <div className="table-test-inline-note">
                向右拖动横向滚动条，观察首列始终贴在左侧。
              </div>
            </div>

            <Table
              columns={wideColumns}
              rows={wideRows}
              rowKey={(row) => row.id}
              stickyFirstColumn
              translate={translateTableLabel({
                "table.noData": "No sticky rows.",
              })}
            />
          </article>

          <article className="table-test-card table-test-card--wide">
            <div className="table-test-card__header">
              <div>
                <h2>Default Viewport Column</h2>
                <p>
                  首次渲染时自动滚到目标列附近，并保留固定首列，让默认视点更接近旧项目“当前列居中”方案。
                </p>
              </div>
              <div className="table-test-inline-note">
                当前目标列: <strong>Score</strong>，首帧会自动把它滚进默认视点。
              </div>
            </div>

            <Table
              columns={wideColumns}
              rows={wideRows}
              rowKey={(row) => row.id}
              stickyFirstColumn
              defaultViewportColumnKey="column-5"
              translate={translateTableLabel({
                "table.noData": "No viewport rows.",
              })}
            />
          </article>

          <article className="table-test-card table-test-card--wide">
            <div className="table-test-card__header">
              <div>
                <h2>Highlighted Columns</h2>
                <p>
                  这一组同时验证列高亮、自定义高亮背景，以及高亮列与固定首列叠加时的表现。
                </p>
              </div>
              <div className="table-test-inline-note">
                当前高亮列: <strong>Dataset</strong>、<strong>Score</strong>、
                <strong>Latest note</strong>
              </div>
            </div>

            <Table
              columns={wideColumns}
              rows={wideRows}
              rowKey={(row) => row.id}
              stickyFirstColumn
              defaultViewportColumnKey="column-5"
              highlightColumns={[
                { key: "title", backgroundColor: "rgba(255, 245, 251, 0.98)" },
                {
                  key: "column-5",
                  backgroundColor: "rgba(255, 235, 246, 0.96)",
                },
                { key: "column-9" },
              ]}
              translate={translateTableLabel({
                "table.noData": "No highlighted rows.",
              })}
            />
          </article>

          <section className="table-test-state-grid">
            <article className="table-test-card">
              <div className="table-test-card__header">
                <h2>Presentational Loading</h2>
                <p>不接控制器，直接用纯展示模式渲染加载态。</p>
              </div>

              <Table
                columns={stateGalleryColumns}
                rows={[]}
                rowKey={(row) => row.id}
                loading
                translate={translateTableLabel({
                  "table.loading": "Loading view-only table...",
                })}
              />
            </article>

            <article className="table-test-card">
              <div className="table-test-card__header">
                <h2>Presentational Empty</h2>
                <p>直接传空数据和自定义 empty 节点，验证静态空态使用方式。</p>
              </div>

              <Table
                columns={stateGalleryColumns}
                rows={[]}
                rowKey={(row) => row.id}
                empty={<span>这里没有任何待展示的数据块。</span>}
              />
            </article>

            <article className="table-test-card table-test-card--full">
              <div className="table-test-card__header">
                <h2>Presentational Error And Wrap</h2>
                <p>
                  一边展示自定义错误态，一边保留一个正常的 wrap
                  列表，方便对比表现。
                </p>
              </div>

              <div className="table-test-split-stack">
                <Table
                  columns={stateGalleryColumns}
                  rows={[]}
                  rowKey={(row) => row.id}
                  error={
                    <span>
                      Static error: virtual request timed out while rendering
                      this segment.
                    </span>
                  }
                />
                <Table
                  columns={stateGalleryColumns}
                  rows={stateGalleryRows}
                  rowKey={(row) => row.id}
                />
              </div>
            </article>
          </section>
        </div>

        <aside className="table-test-sidebar">
          <section className="table-test-panel">
            <h2>Current Controller State</h2>
            <div className="table-test-metrics">
              <div className="table-test-metric">
                <span>Mode</span>
                <strong>{scenarioMode}</strong>
              </div>
              <div className="table-test-metric">
                <span>Query</span>
                <strong>{controller.query || "(empty)"}</strong>
              </div>
              <div className="table-test-metric">
                <span>Sort</span>
                <strong>
                  {controller.sortKey
                    ? `${controller.sortKey} / ${controller.sortDirection}`
                    : "none"}
                </strong>
              </div>
              <div className="table-test-metric">
                <span>Page</span>
                <strong>{controller.page}</strong>
              </div>
              <div className="table-test-metric">
                <span>Page size</span>
                <strong>{controller.pageSize}</strong>
              </div>
              <div className="table-test-metric">
                <span>Total</span>
                <strong>{controller.total}</strong>
              </div>
            </div>
          </section>

          <section className="table-test-panel">
            <h2>Interaction Notes</h2>
            <div className="table-test-checklist">
              <div className="table-test-checklist__item">
                搜索框按 Enter 应提交 query，并重置回第一页。
              </div>
              <div className="table-test-checklist__item">
                点击可排序列应只在 `asc` / `desc` 间切换。
              </div>
              <div className="table-test-checklist__item">
                右键行时，该行会额外高亮；关闭菜单后高亮消失。
              </div>
              <div className="table-test-checklist__item">
                宽表默认不强制换行，而是出现横向滚动条。
              </div>
              <div className="table-test-checklist__item">
                开启 `stickyFirstColumn`
                后，首列在横向滚动中应始终可见并保持背景一致。
              </div>
              <div className="table-test-checklist__item">
                开启 `defaultViewportColumnKey`
                后，首次渲染应自动滚到目标列附近，但后续不强制把用户拉回。
              </div>
              <div className="table-test-checklist__item">
                高亮列应同时作用于表头与表体，自定义 `backgroundColor`
                应覆盖默认高亮色。
              </div>
              <div className="table-test-checklist__item">
                纯展示模式下可以单独使用 loading、empty、error，而不依赖控制器。
              </div>
            </div>
          </section>

          <section className="table-test-panel">
            <h2>Activity Log</h2>
            <div className="table-test-log">
              {activityLog.map((entry, index) => (
                <div key={`${entry}-${index}`} className="table-test-log__item">
                  {entry}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <Modal
        open={Boolean(previewRow)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewRow(null);
          }
        }}
        kicker="Table"
        title={previewRow ? `Preview ${previewRow.displayName}` : "Preview row"}
        tone="info"
        size="table"
        actions={[
          {
            key: "close-preview",
            label: "Close",
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        {previewRow ? (
          <div className="table-test-modal-content">
            <div className="table-test-preview-grid">
              <div>
                <span>Email</span>
                <strong>{previewRow.email}</strong>
              </div>
              <div>
                <span>Role</span>
                <strong>{previewRow.role}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{previewRow.status}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>{previewRow.updatedAt}</strong>
              </div>
            </div>
            <div className="table-test-modal-note">{previewRow.latestNote}</div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteRow)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteRow(null);
          }
        }}
        kicker="Danger"
        title={deleteRow ? `Delete ${deleteRow.displayName}?` : "Delete row?"}
        tone="error"
        size="sm"
        actions={[
          {
            key: "cancel-delete",
            label: "Cancel",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "confirm-delete",
            label: "Delete",
            variant: "danger",
            onClick: ({ close }) => {
              if (deleteRow) {
                pushLog(
                  `Danger confirm clicked for ${deleteRow.displayName} (demo only, no real deletion).`,
                );
              }
              close();
            },
          },
        ]}
      >
        <div className="table-test-modal-content">
          <p>
            这里故意不做真实删除，只用于验证 table 行菜单与 modal 的组合路径。
          </p>
        </div>
      </Modal>
    </main>
  );
}
