import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import { useContextActionsMenu } from "../../../../packages/context-actions";
import "./ContextActionsTestPage.css";

const fileRows = [
  { id: "spec", name: "design-spec.md", owner: "product", status: "Draft" },
  { id: "copy", name: "launch-copy.txt", owner: "marketing", status: "Ready" },
  { id: "schema", name: "schema.sql", owner: "backend", status: "Review" },
];

const boardCards = [
  { id: "todo", title: "To Do", detail: "收集菜单项、分组和禁用态。" },
  { id: "doing", title: "Doing", detail: "验证 hover、danger 和长文案换行。" },
  { id: "done", title: "Done", detail: "确认点击外部和 Esc 能正确关闭。" },
];

const canvasHotspots = [
  {
    id: "top-left",
    label: "Top Left",
    description: "靠近左上角触发，观察菜单不会超出视口。",
    style: { left: "9%", top: "16%" },
  },
  {
    id: "bottom-right",
    label: "Bottom Right",
    description: "靠近右下角触发，观察自动反向定位。",
    style: { right: "10%", bottom: "18%" },
  },
  {
    id: "center",
    label: "Center",
    description: "中间区域触发，便于反复测试多组菜单。",
    style: { left: "50%", top: "48%", transform: "translate(-50%, -50%)" },
  },
];

function createAction(key, label, onClick, options = {}) {
  return {
    key,
    label,
    onClick,
    ...options,
  };
}

export default function ContextActionsTestPage() {
  const navigate = useNavigate();
  const { menu, toggleRightClick, openAt, closeRightClick, isOpen } =
    useContextActionsMenu({ zIndex: 2400 });
  const [activityLog, setActivityLog] = React.useState([
    "右键任一测试区域，验证 context-actions 的分组、禁用态、危险态和定位。",
  ]);

  function pushLog(message) {
    setActivityLog((current) => [message, ...current].slice(0, 8));
  }

  function handleBasicZoneContextMenu(event) {
    toggleRightClick(event, [
      {
        group: 20,
        children: [
          createAction("archive", "Archive draft", () =>
            pushLog("Basic zone: Archive draft"),
          ),
          createAction("share", "Share preview link", () =>
            pushLog("Basic zone: Share preview link"),
          ),
        ],
      },
      {
        group: 10,
        children: [
          createAction("open", "Open detail drawer", () =>
            pushLog("Basic zone: Open detail drawer"),
          ),
          createAction("duplicate", "Duplicate block", () =>
            pushLog("Basic zone: Duplicate block"),
          ),
        ],
      },
      {
        group: 30,
        children: [
          createAction(
            "delete",
            "Delete section",
            () => pushLog("Basic zone: Delete section"),
            { danger: true },
          ),
        ],
      },
    ]);
  }

  function handleStateZoneContextMenu(event) {
    toggleRightClick(event, [
      {
        group: 2,
        children: [
          createAction("rename", "Rename item", () =>
            pushLog("State zone: Rename item"),
          ),
          createAction(
            "disabled",
            "Disabled action",
            () => pushLog("State zone: disabled should not fire"),
            { disabled: true },
          ),
          createAction(
            "hidden",
            "Hidden action",
            () => pushLog("State zone: hidden should not render"),
            { hidden: true },
          ),
        ],
      },
      {
        group: 1,
        children: [],
      },
      {
        group: 4,
        children: [
          createAction(
            "danger",
            "Force remove",
            () => pushLog("State zone: Force remove"),
            { danger: true },
          ),
        ],
      },
    ]);
  }

  function handleRowContextMenu(event, row) {
    toggleRightClick(event, [
      {
        group: 1,
        children: [
          createAction(`${row.id}-open`, `Open ${row.name}`, () =>
            pushLog(`Row ${row.name}: Open`),
          ),
          createAction(`${row.id}-owner`, `Assign to ${row.owner}`, () =>
            pushLog(`Row ${row.name}: Assign to ${row.owner}`),
          ),
        ],
      },
      {
        group: 2,
        children: [
          createAction(
            `${row.id}-status`,
            `Status: ${row.status}`,
            () => pushLog(`Row ${row.name}: Status ${row.status}`),
            { disabled: true },
          ),
        ],
      },
      {
        group: 3,
        children: [
          createAction(
            `${row.id}-delete`,
            `Delete ${row.name}`,
            () => pushLog(`Row ${row.name}: Delete`),
            { danger: true },
          ),
        ],
      },
    ]);
  }

  function handleCardContextMenu(event, card) {
    toggleRightClick(event, [
      {
        group: 1,
        children: [
          createAction(`${card.id}-inspect`, `Inspect ${card.title}`, () =>
            pushLog(`Board ${card.title}: Inspect`),
          ),
          createAction(
            `${card.id}-long-label`,
            "Preview an intentionally longer action label to observe wrapping and width constraints",
            () => pushLog(`Board ${card.title}: Long label action`),
          ),
        ],
      },
      {
        group: 5,
        children: [
          createAction(
            `${card.id}-clear`,
            `Clear ${card.title}`,
            () => pushLog(`Board ${card.title}: Clear`),
            { danger: true },
          ),
        ],
      },
    ]);
  }

  function handleCanvasContextMenu(event, hotspot) {
    toggleRightClick(event, [
      {
        group: 1,
        children: [
          createAction(
            `${hotspot.id}-pin`,
            `Pin marker at ${hotspot.label}`,
            () => pushLog(`Canvas ${hotspot.label}: Pin marker`),
          ),
          createAction(
            `${hotspot.id}-inspect`,
            "Inspect offset and viewport fit",
            () =>
              pushLog(
                `Canvas ${hotspot.label}: Inspect offset and viewport fit`,
              ),
          ),
        ],
      },
      {
        group: 2,
        children: [
          createAction(
            `${hotspot.id}-danger`,
            "Delete marker",
            () => pushLog(`Canvas ${hotspot.label}: Delete marker`),
            { danger: true },
          ),
        ],
      },
    ]);
  }

  function openProgrammaticMenu() {
    openAt(
      {
        x: Math.max(window.innerWidth - 280, 24),
        y: 112,
      },
      [
        {
          group: 1,
          children: [
            createAction(
              "programmatic-refresh",
              "Refresh current snapshot",
              () => pushLog("Programmatic menu: Refresh current snapshot"),
            ),
            createAction("programmatic-export", "Export menu diagnostics", () =>
              pushLog("Programmatic menu: Export menu diagnostics"),
            ),
          ],
        },
        {
          group: 2,
          children: [
            createAction("programmatic-close", "Close without selection", () =>
              pushLog("Programmatic menu: Close without selection"),
            ),
          ],
        },
      ],
    );
    pushLog("Programmatic menu opened via openAt().");
  }

  return (
    <main className="context-actions-test-page">
      <section className="context-actions-test-hero">
        <div className="context-actions-test-hero__copy">
          <p className="context-actions-test-eyebrow">
            /test/frontend/packages/context-actions
          </p>
          <h1>Context Actions Playground</h1>
          <p className="context-actions-test-lead">
            这里集中测试 `frontend/src/packages/context-actions`
            的常见使用方式，包括右键触发、分组排序、 hidden/disabled
            过滤、危险项样式、长文案换行，以及 `openAt()` 的程序化打开。
          </p>
        </div>
        <div className="context-actions-test-hero__actions">
          <Button onClick={() => navigate("/home")}>返回首页</Button>
          <Button variant="secondary" onClick={openProgrammaticMenu}>
            按钮触发 openAt()
          </Button>
          <Button
            variant="secondary"
            onClick={closeRightClick}
            disabled={!isOpen}
          >
            关闭当前菜单
          </Button>
        </div>
      </section>

      <section className="context-actions-test-layout">
        <div className="context-actions-test-main">
          <article className="context-actions-test-card">
            <div className="context-actions-test-card__header">
              <h2>基础分组与排序</h2>
              <p>
                在这个大区域内右键，观察 group
                会按数字排序，并在非空组之间自动插入分隔线。
              </p>
            </div>
            <div
              className="context-actions-test-target context-actions-test-target--hero"
              onContextMenu={handleBasicZoneContextMenu}
            >
              <strong>右键这里</strong>
              <span>
                期望看到 open / duplicate / archive / share / delete，且 delete
                单独位于危险组。
              </span>
            </div>
          </article>

          <article className="context-actions-test-card">
            <div className="context-actions-test-card__header">
              <h2>Hidden 与 Disabled</h2>
              <p>
                右键后检查 hidden 项不会渲染，disabled
                项可见但不可点击，空组也会被自动移除。
              </p>
            </div>
            <div
              className="context-actions-test-target context-actions-test-target--soft"
              onContextMenu={handleStateZoneContextMenu}
            >
              <strong>右键这里</strong>
              <span>验证 disabled 样式、hidden 过滤，以及危险项高亮。</span>
            </div>
          </article>

          <article className="context-actions-test-card">
            <div className="context-actions-test-card__header">
              <h2>列表行场景</h2>
              <p>
                每一行绑定独立菜单，适合 table/list
                使用场景。分别对各行右键，观察菜单文案是否按当前行生成。
              </p>
            </div>
            <div className="context-actions-test-list">
              {fileRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="context-actions-test-row"
                  onContextMenu={(event) => handleRowContextMenu(event, row)}
                >
                  <span className="context-actions-test-row__name">
                    {row.name}
                  </span>
                  <span className="context-actions-test-row__meta">
                    {row.owner}
                  </span>
                  <span className="context-actions-test-row__status">
                    {row.status}
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="context-actions-test-card">
            <div className="context-actions-test-card__header">
              <h2>长文案与多区域</h2>
              <p>
                三个卡片共享一个菜单模式，但会带不同上下文。长文案可用于测试宽度约束和多行换行。
              </p>
            </div>
            <div className="context-actions-test-board">
              {boardCards.map((card) => (
                <div
                  key={card.id}
                  className="context-actions-test-board__card"
                  onContextMenu={(event) => handleCardContextMenu(event, card)}
                >
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                  <span>右键当前卡片查看专属菜单</span>
                </div>
              ))}
            </div>
          </article>

          <article className="context-actions-test-card context-actions-test-card--wide">
            <div className="context-actions-test-card__header">
              <h2>边缘定位测试</h2>
              <p>
                分别右键左上、中央、右下热点，验证菜单会自动避开视口边缘，靠边时不会溢出窗口。
              </p>
            </div>
            <div className="context-actions-test-canvas">
              {canvasHotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className="context-actions-test-hotspot"
                  style={hotspot.style}
                  onContextMenu={(event) =>
                    handleCanvasContextMenu(event, hotspot)
                  }
                >
                  <strong>{hotspot.label}</strong>
                  <span>{hotspot.description}</span>
                </button>
              ))}
            </div>
          </article>
        </div>

        <aside className="context-actions-test-sidebar">
          <section className="context-actions-test-panel">
            <h2>操作反馈</h2>
            <p>点击任意菜单项后，这里会记录最近操作，方便确认回调是否命中。</p>
            <div className="context-actions-test-log">
              {activityLog.map((entry, index) => (
                <div
                  key={`${entry}-${index}`}
                  className="context-actions-test-log__item"
                >
                  {entry}
                </div>
              ))}
            </div>
          </section>

          <section className="context-actions-test-panel">
            <h2>建议验证点</h2>
            <div className="context-actions-test-checklist">
              <div className="context-actions-test-checklist__item">
                右键打开后，点击外部区域应立即关闭菜单。
              </div>
              <div className="context-actions-test-checklist__item">
                按 `Esc` 只关闭当前菜单，不触发额外副作用。
              </div>
              <div className="context-actions-test-checklist__item">
                长文案 action 在窄窗口下应保持可读，不应超出视口。
              </div>
              <div className="context-actions-test-checklist__item">
                disabled 项可见但不可点击；hidden 项完全不应出现。
              </div>
              <div className="context-actions-test-checklist__item">
                滚动页面后菜单会关闭，再次右键应重新按新位置打开。
              </div>
            </div>
          </section>
        </aside>
      </section>

      {menu}
    </main>
  );
}
