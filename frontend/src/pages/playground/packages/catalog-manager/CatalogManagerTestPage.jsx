import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import { CatalogManager } from "../../../../packages/catalog-manager";
import {
  createGroup,
  replaceNodeAtPath,
} from "../../../../packages/catalog-manager/core/tree-utils";
import { Navigator } from "../../../../packages/navigator";
import "./CatalogManagerTestPage.css";

function CatalogCompactIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
    >
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

const initialData = [
  {
    _kind: "catalog-group",
    _key: "g_intro",
    title: "Getting Started",
    children: [
      { id: 1, title: "Welcome", author: "Admin", status: "published" },
      { id: 2, title: "Installation Guide", author: "Admin", status: "draft" },
    ],
  },
  {
    _kind: "catalog-group",
    _key: "g_advanced",
    title: "Advanced Topics",
    children: [
      {
        id: 3,
        title: "Performance Tuning",
        author: "Engineer",
        status: "published",
      },
      {
        _kind: "catalog-group",
        _key: "g_nested",
        title: "Nested Sub-group",
        children: [
          { id: 5, title: "Deep topic 1", author: "Engineer", status: "draft" },
          { id: 6, title: "Deep topic 2", author: "Engineer", status: "draft" },
        ],
      },
      {
        id: 4,
        title: "Security Best Practices",
        author: "Security",
        status: "review",
      },
    ],
  },
  { id: 7, title: "Standalone FAQ", author: "Admin", status: "published" },
];

function getStatusBadge(status) {
  const map = {
    published: {
      className: "test-catalog-status-published",
      label: "Published",
    },
    draft: { className: "test-catalog-status-draft", label: "Draft" },
    review: { className: "test-catalog-status-review", label: "Review" },
  };
  const s = map[status] || {
    className: "test-catalog-status-draft",
    label: status,
  };
  return <span className={`test-catalog-badge ${s.className}`}>{s.label}</span>;
}

function InjectArticleTool() {
  return {
    key: "catalog.inject-article",
    name: "Inject Article",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    group: 2,
    order: 1,
    onClick: (ctx) => {
      const newArticle = {
        id: Date.now(),
        title: `New Article ${Date.now().toString(36).slice(-4)}`,
        author: "Test User",
        status: "draft",
      };
      ctx.setItems([...ctx.items, newArticle]);
    },
    getContextMenuGroups: (_ctx, node, _path) => {
      if (node && typeof node === "object" && "id" in node && "title" in node) {
        return [
          {
            group: 100,
            children: [
              {
                key: "test.duplicate",
                label: `Duplicate "${node.title}"`,
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                ),
                onClick: () => {
                  const dup = { ...node, id: Date.now() };
                  ctx.setItems([...ctx.items, dup]);
                },
              },
            ],
          },
        ];
      }
      return [];
    },
  };
}

function DropToGroupTool() {
  return {
    key: "catalog.create-group",
    name: "New Group",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    group: 2,
    order: 2,
    onClick: (ctx) => {
      const group = createGroup("Resources");
      ctx.setItems([...ctx.items, group]);
    },
    getContextMenuGroups: (_ctx, node, _path) => {
      if (
        node &&
        typeof node === "object" &&
        "_kind" in node &&
        node._kind === "catalog-group"
      ) {
        return [
          {
            group: 200,
            children: [
              {
                key: "test.add-child",
                label: "Add empty item",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                ),
                onClick: () => {
                  const next = replaceNodeAtPath(
                    ctx.items,
                    _path,
                    (current) => {
                      if (!current || current._kind !== "catalog-group") {
                        return current;
                      }

                      return {
                        ...current,
                        children: current.children.concat({
                          id: Date.now(),
                          title: `Child ${Date.now().toString(36).slice(-4)}`,
                          author: "Test",
                          status: "draft",
                        }),
                      };
                    },
                  );
                  ctx.setItems(next);
                },
              },
            ],
          },
        ];
      }
      return [];
    },
  };
}

export default function CatalogManagerTestPage() {
  const navigate = useNavigate();
  const [data, setData] = React.useState(initialData);
  const [activityLog, setActivityLog] = React.useState([
    "Initial catalog loaded with 8 items across 3 groups.",
  ]);

  function pushLog(message) {
    setActivityLog((current) => [message, ...current].slice(0, 15));
  }

  const onChange = React.useCallback((next) => {
    setData(next);
    pushLog(`Catalog updated: ${next.length} root items`);
  }, []);

  function renderItem(item, _path) {
    return (
      <span className="test-catalog-item-render">
        <span className="test-catalog-item-title">
          {String(item.title || "Untitled")}
        </span>
        <span className="test-catalog-item-meta">
          {item.author ? <span>{String(item.author)}</span> : null}
          {item.status ? getStatusBadge(String(item.status)) : null}
        </span>
      </span>
    );
  }

  const testTools = [InjectArticleTool(), DropToGroupTool()];

  // ------ convert catalog data to Navigator NavigateNode, demo data ------ //
  const navItems = React.useMemo(() => {
    function toNavNode(item, depth = 0) {
      if (
        item &&
        typeof item === "object" &&
        "_kind" in item &&
        item._kind === "catalog-group"
      ) {
        return {
          key: item._key || `group_${Date.now().toString(36)}`,
          label: String(item.title || "Group"),
          level: Math.min(depth + 1, 4),
          defaultCollapsed: false,
          children: (item.children || []).map((child) =>
            toNavNode(child, depth + 1),
          ),
        };
      }
      if (item && typeof item === "object" && "id" in item && "title" in item) {
        const status = item.status;
        return {
          key: `item_${item.id}`,
          label: String(item.title || "Untitled"),
          level: Math.min(depth + 1, 4),
          data: item,
          badge: status ? getStatusBadge(String(status)) : undefined,
        };
      }
      return {
        key: `unknown_${Date.now().toString(36)}`,
        label: "Unknown",
        level: 1,
      };
    }
    return data.map((item) => toNavNode(item));
  }, [data]);

  const [navLog, setNavLog] = React.useState([
    "Click a navigator item to see the log.",
  ]);
  function pushNavLog(msg) {
    setNavLog((current) => [msg, ...current].slice(0, 15));
  }
  const handleNavigate = React.useCallback((node) => {
    pushNavLog(
      `Navigated to: "${node.label}" (key: ${node.key}, level: ${node.level || 1})`,
    );
  }, []);

  // ------ currentKey demo: select a node to highlight in both navigators ------ //
  const [activeKey, setActiveKey] = React.useState("item_1");
  const leafKeys = React.useMemo(() => {
    const keys = [];
    function collect(nodes) {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) collect(n.children);
        else keys.push(n.key);
      }
    }
    collect(navItems);
    return keys;
  }, [navItems]);

  return (
    <main className="catalog-test-page">
      <section className="catalog-test-hero">
        <div className="catalog-test-hero__copy">
          <p className="catalog-test-eyebrow">
            /test/frontend/packages/catalog-manager
          </p>
          <h1>Catalog Manager Playground</h1>
          <p className="catalog-test-lead">
            Test the catalog-manager package: drag-and-drop reordering, nested
            groups, right-click context menus, extensible toolbar, and custom
            item rendering. Also try the floating Navigator (top-right) for
            outline-style navigation.
          </p>
        </div>
        <div className="catalog-test-hero__actions">
          <Button onClick={() => navigate("/home")}>Back Home</Button>
          <Button variant="secondary" onClick={() => setData(initialData)}>
            Reset
          </Button>
        </div>
      </section>

      <section className="catalog-test-layout">
        <div className="catalog-test-main">
          <div className="catalog-test-card">
            <div className="catalog-test-card__header">
              <h2>Chapter Manager</h2>
              <p>
                Toolbar groups now render dividers, tools expand on hover, and
                rows can move before, after, or into groups.
              </p>
            </div>
            <CatalogManager
              value={data}
              onChange={onChange}
              tools={testTools}
              renderItem={renderItem}
            />
          </div>

          {/* Embedded Navigator – directly below Chapter Manager for easy testing */}
          <div className="catalog-test-card">
            <div className="catalog-test-card__header">
              <h2>Embedded Navigator (currentKey demo)</h2>
              <p>
                This Navigator is in <strong>embedded</strong> mode — inline in
                the document flow. The "currentKey" prop controls which node is
                highlighted. Use the buttons below to switch the active key.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {leafKeys.map((k) => {
                const node = (function find(nodes) {
                  for (const n of nodes) {
                    if (n.key === k) return n;
                    if (n.children) {
                      const found = find(n.children);
                      if (found) return found;
                    }
                  }
                  return null;
                })(navItems);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setActiveKey(k)}
                    style={{
                      padding: "6px 14px",
                      border:
                        activeKey === k
                          ? "1px solid var(--accent-deep)"
                          : "1px solid var(--line-soft)",
                      borderRadius: "999px",
                      background:
                        activeKey === k
                          ? "rgba(255, 94, 159, 0.1)"
                          : "rgba(255, 255, 255, 0.6)",
                      color:
                        activeKey === k
                          ? "var(--accent-deep)"
                          : "var(--text-soft)",
                      fontWeight: activeKey === k ? 700 : 400,
                      cursor: "pointer",
                      fontSize: "0.82rem",
                    }}
                  >
                    {node ? node.label : k}
                  </button>
                );
              })}
            </div>
            <Navigator
              items={navItems}
              onNavigate={handleNavigate}
              currentKey={activeKey}
              embedded
              expandedHeight="none"
            />
          </div>
        </div>

        <aside className="catalog-test-sidebar">
          <section className="catalog-test-panel">
            <h2>Activity Log</h2>
            <p>Recent catalog mutations and interactions.</p>
            <div className="catalog-test-log">
              {activityLog.map((entry, i) => (
                <div key={`${i}`} className="catalog-test-log__item">
                  {entry}
                </div>
              ))}
            </div>
          </section>

          <section className="catalog-test-panel">
            <h2>Verification Checklist</h2>
            <div className="catalog-test-checklist">
              <div className="catalog-test-checklist__item">
                Drag a row above/below — reorders within same parent.
              </div>
              <div className="catalog-test-checklist__item">
                Drag a row into a group header or its child area — it becomes a
                child of that group.
              </div>
              <div className="catalog-test-checklist__item">
                Drag a row out of a group to the root list tail — it moves back
                to root level.
              </div>
              <div className="catalog-test-checklist__item">
                Right-click a row — see Move Up/Down, custom tools, Rename
                (groups), Delete.
              </div>
              <div className="catalog-test-checklist__item">
                Toolbar: custom tools render first, grouped by divider; built-in
                "Add group" stays in the last group.
              </div>
              <div className="catalog-test-checklist__item">
                Toolbar tools show icons by default and reveal names on hover.
              </div>
              <div className="catalog-test-checklist__item">
                Hover a row — action buttons (move/rename/delete) appear.
              </div>
              <div className="catalog-test-checklist__item">
                Nested group renders with proper indentation.
              </div>
            </div>
          </section>

          <section className="catalog-test-panel">
            <h2>Live JSON</h2>
            <p>
              Current catalog value updates in real time while you drag, rename,
              delete, and insert items.
            </p>
            <pre className="catalog-test-json">
              {JSON.stringify(data, null, 2)}
            </pre>
          </section>
        </aside>
      </section>

      {/* Navigator demo section */}
      <section className="catalog-test-layout" style={{ marginTop: 28 }}>
        <div className="catalog-test-main">
          <div className="catalog-test-card">
            <div className="catalog-test-card__header">
              <h2>Navigator Package Demo</h2>
              <p>
                A floating navigator renders the same catalog data as a nested
                outline. Resize this window below 900px to see auto-collapse
                into a draggable toggle button. Click nodes to see the navigate
                log. H1-level groups are collapsible — click the chevron.
              </p>
            </div>
            <div className="catalog-test-checklist">
              <div className="catalog-test-checklist__item">
                Floating panel stays fixed when scrolling.
              </div>
              <div className="catalog-test-checklist__item">
                H1 groups have a chevron to expand/collapse H2 children.
              </div>
              <div className="catalog-test-checklist__item">
                H2 nodes are indented under their parent H1.
              </div>
              <div className="catalog-test-checklist__item">
                Click an item — the navigate log records it.
              </div>
              <div className="catalog-test-checklist__item">
                With &lt;900px viewport: panel collapses to a draggable floating
                button.
              </div>
              <div className="catalog-test-checklist__item">
                Drag the toggle button to reposition it.
              </div>
              <div className="catalog-test-checklist__item">
                Panel has both vertical and horizontal scrollbars when content
                overflows.
              </div>
            </div>
          </div>
        </div>
        <aside className="catalog-test-sidebar">
          <section className="catalog-test-panel">
            <h2>Navigator Click Log</h2>
            <p>Every click on a navigator node is logged here.</p>
            <div className="catalog-test-log">
              {navLog.map((entry, i) => (
                <div key={`nav-${i}`} className="catalog-test-log__item">
                  {entry}
                </div>
              ))}
            </div>
          </section>
          <section className="catalog-test-panel">
            <h2>Navigator Items (Live)</h2>
            <p>Navigation tree built from catalog data. Syncs in real time.</p>
            <pre className="catalog-test-json">
              {JSON.stringify(
                navItems,
                (key, value) =>
                  key === "badge" || key === "data" ? undefined : value,
                2,
              )}
            </pre>
          </section>
        </aside>
      </section>

      {/* Floating Navigator – for collapse/drag/fixed-position testing */}
      <Navigator
        items={navItems}
        onNavigate={handleNavigate}
        initialPosition="top-right"
        minPageWidth={900}
        minPageHeight={620}
        expandedWidth={280}
        storageKey="catalog-test-navigator-pos"
        currentKey={activeKey}
        compactIcon={<CatalogCompactIcon />}
      />
    </main>
  );
}
