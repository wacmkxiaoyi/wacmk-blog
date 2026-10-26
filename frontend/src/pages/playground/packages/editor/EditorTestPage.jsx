import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button.jsx";
import {
  buildDefaultEditorTools,
  RichTextEditor,
} from "../../../../packages/editor/index.ts";
import {
  ContentRenderer,
  MarkdownPreset,
} from "../../../../packages/content-renderer/index.ts";
import { createEmailFormTool } from "./emailFormExtension.tsx";
import "./EditorTestPage.css";

const PRESETS = {
  comprehensive: {
    title: "Comprehensive Coverage",
    description:
      "覆盖标题、颜色、列表、代码、公式、Adomonition、tabs、表格和媒体。",
    markdown: [
      "# Editor Coverage Lab",
      "",
      "这段正文同时包含 **加粗**、*斜体*、~~删除线~~、++下划线++、`inline-code` 与 [蓝色强调]{.md-color-blue}。",
      "",
      "## Multi-line List Selection",
      "",
      "- Primary list item",
      "- Second list item",
      "- Third list item",
      "",
      "1. Ordered alpha",
      "2. Ordered beta",
      "3. Ordered gamma",
      "",
      "- [x] Completed task",
      "- [ ] Pending task",
      "- [ ] Another pending task",
      "",
      "```ts",
      "export function buildPayload(input: string) {",
      "  return { input, length: input.length, mode: 'editor-playground' };",
      "}",
      "```",
      "",
      String.raw`行内公式：\(a^2 + b^2 = c^2\)`,
      "",
      "$$",
      "\\int_0^1 x^2 \\, dx = 1/3",
      "$$",
      "",
      '???+ note "title"',
      "    这里用于验证 Adomonition 的现场编辑、右键切换类型与折叠状态。",
      "",
      '=== "title"',
      "    这是第一个 tab 的正文。",
      "",
      "| Feature | Status |",
      "| --- | --- |",
      "| Inline color palette | ready |",
      "| Table matrix picker | ready |",
      "",
      '![Hero poster](https://dummyimage.com/960x480/e9d5ff/5b21b6.png&text=Editor+Playground "editor")',
      "",
      '::video{src="https://www.w3schools.com/html/mov_bbb.mp4" title="Editor demo"}',
      "",
      '::custom{kind="email-form" title="Newsletter signup" description="Capture a test email without touching the editor internals." label="Email" placeholder="name@example.com" buttonText="Submit"}',
    ].join("\n"),
  },
  multilineIndent: {
    title: "Multi-line Indent",
    description: "优先验证多行选中后右键 increase/decrease indent。",
    markdown: [
      "# Multi-line Indent Stress",
      "",
      "先连续选中下面多个 list item，再右键测试缩进。",
      "",
      "- Item A",
      "- Item B",
      "- Item C",
      "- Item D",
      "",
      "- [ ] Task A",
      "- [ ] Task B",
      "- [ ] Task C",
      "- [ ] Task D",
      "",
      "1. Ordered 1",
      "2. Ordered 2",
      "3. Ordered 3",
      "4. Ordered 4",
    ].join("\n"),
  },
  blocks: {
    title: "Blocks And Context Actions",
    description:
      "集中验证 Adomonition、tabs、table、math、code block 的右键与现场编辑。",
    markdown: [
      "# Block Interaction Matrix",
      "",
      '???+ note "title"',
      "    空块也要支持直接编辑。",
      "",
      '=== "title"',
      "    Tab one body",
      "",
      "```javascript",
      "const featureFlags = ['context-actions', 'inline-palette', 'table-picker'];",
      "console.log(featureFlags.join(', '));",
      "```",
      "",
      "$$",
      "f(x) = x^3 - 2x + 1",
      "$$",
      "",
      "| Name | Value | Note |",
      "| --- | --- | --- |",
      "| Code block | Prism | Change language via context menu |",
      "| Tabs | Inline editing | Add/Delete via context menu |",
    ].join("\n"),
  },
  markdownMode: {
    title: "Markdown Mode",
    description:
      "验证 Markdown 原始编辑、Tab/Shift+Tab 缩进、以及 renderer round-trip。",
    markdown: [
      "# Markdown Mode Round Trip",
      "",
      "在 Markdown 模式下测试：",
      "",
      "- Tab 增加缩进",
      "- Shift+Tab 减少缩进",
      "- Color、Table、Adomonition、tabs 仍然能插入正确语法",
      "",
      "```bash",
      "npm run build",
      "```",
      "",
      '???+ tip "title"',
      "    markdown mode body",
      "",
      '=== "title"',
      "    markdown mode tab body",
      "",
      '::custom{kind="email-form" title="Markdown Form" description="This should round-trip through markdown mode." label="Work email" placeholder="team@company.com" buttonText="Preview submit"}',
    ].join("\n"),
  },
  htmlBlocks: {
    title: "HTML Blocks",
    description:
      "集中验证 HTML 工具、实时预览、右键重新编辑，以及 ::html markdown round-trip。",
    markdown: [
      "# HTML Block Playground",
      "",
      "先用工具栏插入新的 HTML block，再对现有 block 右键测试 Modify。",
      "",
      "::html",
      ':: <section style="padding:20px;border:1px solid #c4b5fd;border-radius:16px;background:linear-gradient(135deg,#f5f3ff,#eff6ff);font-family:Arial,sans-serif;">',
      '::   <h2 style="margin:0 0 12px;color:#4c1d95;">Interactive HTML Block</h2>',
      '::   <p style="margin:0 0 12px;color:#334155;">This preview runs inside a sandboxed iframe.</p>',
      "::   <button onclick=\"this.textContent='Clicked';this.style.background='#4f46e5';this.style.color='#fff';\" style=\"padding:10px 14px;border:0;border-radius:999px;background:#ddd6fe;cursor:pointer;\">Click me</button>",
      "::   <script>window.__htmlBlockReady = true;<\/script>",
      ":: </section>",
    ].join("\n"),
  },
  navigation: {
    title: "Navigation Stress",
    description:
      "专门验证 Navigation 工具的 h1/h2/h3 抽取、超长单行标题、独立滚动与跳转表现。",
    markdown: [
      "# Navigation Stress Harness With An Extremely Long Heading That Should Remain On One Single Line Inside The Navigation Sidebar Without Wrapping Even When The Title Keeps Growing Wider Than The Fixed Panel",
      "",
      "这一段正文用于把右侧渲染区撑长，方便测试目录与正文滚动是否彻底分离。",
      "",
      "## Secondary Heading With Another Intentionally Long Sentence To Confirm Horizontal Scrolling Stays Inside The Navigation Sidebar And Does Not Stretch The Main Render Column",
      "",
      "继续补充多段正文，确保点击目录后可以明显观察到滚动跳转。",
      "",
      "这里再写一段普通段落，模拟真实文档中的解释文本、产品说明和操作步骤。",
      "",
      "### Third Level Heading With A Long Tail For Verifying Two-Space Visual Indentation While Still Preserving Single-Line Display Inside The Navigation Area",
      "",
      "- 第一条：检查目录是否只包含 h1 h2 h3",
      "- 第二条：检查长标题是否始终一行",
      "- 第三条：检查目录横向滚动条是否单独出现",
      "",
      "## Another Section For Jump Validation",
      "",
      "为了让滚动距离更明显，这里补一组重复段落。",
      "",
      ...Array.from(
        { length: 12 },
        (_, index) =>
          `第 ${index + 1} 段回归文本：导航面板应保持固定宽度，正文区域应独立纵向滚动，点击目录项后定位到对应标题。`,
      ),
      "",
      "### Final Deep Heading Used To Confirm Active State Updates While The Render Viewport Scrolls Independently From The Sidebar",
      "",
      ...Array.from(
        { length: 10 },
        (_, index) =>
          `收尾段落 ${index + 1}：继续拉长页面，方便测试 active heading 更新、滚动惯性和小屏布局。`,
      ),
    ].join("\n"),
  },
};

const CHECKLIST = [
  "多行选中 bullet/ordered/task list 后，右键 increase indent 生效。",
  "多行选中 list 后，右键 decrease indent 只影响选中项。",
  "右键落点在当前选区内时，不会取消原有多行选区。",
  "文本行右键出现 Add a paragraph below，并在当前块下方插入空 paragraph。",
  "admonition、tabs 内部文本右键 Add a paragraph below 时，会在整个外层块下方插入空 paragraph。",
  "code block、math block、image、video、custom block 右键出现 Add a paragraph below。",
  "所有文本/块右键底部统一出现 Delete，删除当前完整块；admonition、tabs 内部文本会删除整个外层块。",
  "table 右键使用统一 Delete 删除整张表，不再单独出现 Delete table。",
  "admonition、tabs、code block、math block、image、video 等块的 increase/decrease indent 可用性跟随文本语义。",
  "Color 弹出横向色卡，图标与文字都带颜色。",
  "Table 点击后出现 2x2 到 10x10 的矩阵。",
  "Adomonition 点击直接插入，块内直接编辑 title/body。",
  "Adomonition 右键切类型、切折叠、删除块。",
  "Tabs 点击直接插入，右键 add/delete tab。",
  "Link 右键菜单使用 Modify / Unlink；image 右键菜单使用 Modify / Delete。",
  "Video 在画面区域和控件区域右键时，都应出现 Modify / Delete。",
  "Code block 视觉效果与 renderer 对齐，并带复制按钮。",
  "Math inline/block 双击编辑，block 不再显示工具条。",
  "块级公式右键出现 Edit formula，删除走统一底部 Delete。",
  "行内公式右键仍只有 Edit formula。",
  "HTML 工具会打开带实时预览的 modal，保存后插入 ::html block。",
  "HTML block 右键出现 Modify，重新打开 editor 后保存应更新当前块而不是新增。",
  "外部 email-form 工具无需修改 editor 主体即可插入、渲染并在右键下切换文案。",
  "Markdown 输出与 Renderer Preview 保持一致。",
  "Navigation 工具位于 Markdown 右侧，点击后切换为目录 + 渲染区双栏布局。",
  "Navigation 只抽取 h1 / h2 / h3，且 h2 / h3 在目录里有层级缩进。",
  "超长 h1 / h2 / h3 在目录中保持单行显示，显示不全时只出现目录区横向滚动。",
  "目录区与右侧内容区的纵向滚动互不影响，可以分别控制。",
  "点击目录项后，右侧渲染区跳转到对应 heading，并更新当前激活项。",
  "Document Snapshot 能观察统一 schema 结构。",
];

function buildRendererLabels() {
  return {
    copy: "Copy",
    copied: "Copied",
    expand: "Expand",
    collapse: "Collapse",
    permalink: "Permalink",
  };
}

export default function EditorTestPage() {
  const navigate = useNavigate();
  const [presetKey, setPresetKey] = React.useState("comprehensive");
  const [markdown, setMarkdown] = React.useState(
    PRESETS.comprehensive.markdown,
  );
  const [documentState, setDocumentState] = React.useState(null);
  const tools = React.useMemo(
    () => [
      ...buildDefaultEditorTools((key, fallback) => fallback),
      createEmailFormTool(),
    ],
    [],
  );
  const activePreset = PRESETS[presetKey];

  function applyPreset(key) {
    setPresetKey(key);
    setMarkdown(PRESETS[key].markdown);
  }

  return (
    <main className="editor-test-page">
      <section className="editor-test-hero">
        <div className="editor-test-hero__copy">
          <p className="editor-test-eyebrow">/test/frontend/packages/editor</p>
          <h1>Editor Scenario Lab</h1>
          <p className="editor-test-lead">
            这个页面不再只是简单演示，而是把 `packages/editor`
            的多行缩进、右键菜单、现场编辑、 Markdown round-trip、renderer
            对齐和复杂 block 交互全部放到一个完整测试台里。
          </p>
        </div>
        <div className="editor-test-hero__actions">
          <Button onClick={() => navigate("/home")}>返回首页</Button>
        </div>
      </section>

      <section className="editor-test-presets">
        <div className="editor-test-section-title">
          <h2>Scenario Presets</h2>
          <p>快速切换不同输入，集中验证某一类交互，不用手动重造数据。</p>
        </div>
        <div className="editor-test-preset-grid">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className={`editor-test-preset-card${key === presetKey ? " is-active" : ""}`}
              onClick={() => applyPreset(key)}
            >
              <span className="editor-test-preset-card__title">
                {preset.title}
              </span>
              <span className="editor-test-preset-card__description">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="editor-test-layout">
        <div className="editor-test-main">
          <article className="editor-test-card editor-test-card--editor">
            <div className="editor-test-card__header editor-test-card__header--split">
              <div>
                <h2>Main Editor Lab</h2>
                <p>{activePreset.description}</p>
              </div>
              <div className="editor-test-inline-pill">
                Preset: {activePreset.title}
              </div>
            </div>
            <div className="editor-test-extension-note">
              <strong>External tool proof:</strong> `Email Form` 由测试页通过
              `tools` 追加注入，editor 主体没有为它新增专用按钮分支。
            </div>
            <RichTextEditor
              value={markdown}
              tools={tools}
              onChange={(nextMarkdown, nextDocument) => {
                setMarkdown(nextMarkdown);
                setDocumentState(nextDocument);
              }}
              translate={(key, fallback) => fallback}
              minHeight={320}
              initialHeight={320}
            />
          </article>

          <div className="editor-test-grid editor-test-grid--outputs">
            <article className="editor-test-card">
              <div className="editor-test-card__header">
                <h2>Markdown Output</h2>
                <p>
                  实时观察最终保存值，重点检查多行缩进、tabs 和 Adomonition
                  结构。
                </p>
              </div>
              <pre className="editor-test-code">{markdown}</pre>
            </article>

            <article className="editor-test-card">
              <div className="editor-test-card__header">
                <h2>Renderer Preview</h2>
                <p>
                  用现有 `content-renderer` 再渲染一次，直接比较 editor
                  输出与最终展示是否一致。
                </p>
              </div>
              <div className="editor-test-renderer-preview">
                <ContentRenderer
                  format="markdown"
                  value={markdown}
                  adapter={MarkdownPreset.adapter}
                  plugins={MarkdownPreset.plugins}
                  anchorNavigation={{ enabled: true, updateHash: true }}
                  customComponents={{
                    "email-form": ({ node }) => {
                      const data = node.data || {};
                      const [email, setEmail] = React.useState("");
                      const [submittedEmail, setSubmittedEmail] =
                        React.useState("");
                      return (
                        <div className="editor-test-email-form editor-test-email-form--preview">
                          <div className="editor-test-email-form__header">
                            <p className="editor-test-email-form__eyebrow">
                              Renderer Preview
                            </p>
                            <h3>{String(data.title || "Newsletter signup")}</h3>
                            <p>
                              {String(
                                data.description ||
                                  "Capture a test email without touching the editor internals.",
                              )}
                            </p>
                          </div>
                          <div className="editor-test-email-form__body">
                            <label className="editor-test-email-form__field">
                              <span>{String(data.label || "Email")}</span>
                              <input
                                type="email"
                                value={email}
                                placeholder={String(
                                  data.placeholder || "name@example.com",
                                )}
                                onChange={(event) =>
                                  setEmail(event.target.value)
                                }
                              />
                            </label>
                            <div className="editor-test-email-form__actions">
                              <button
                                type="button"
                                onClick={() => setSubmittedEmail(email)}
                              >
                                {String(data.buttonText || "Submit")}
                              </button>
                              <span className="editor-test-email-form__status">
                                {submittedEmail
                                  ? `Pretend submitted: ${submittedEmail}`
                                  : "Renderer preview uses the same external custom block contract."}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  }}
                  labels={buildRendererLabels()}
                  options={{ enableHeadingAnchor: false }}
                />
              </div>
            </article>
          </div>
        </div>

        <aside className="editor-test-sidebar">
          <article className="editor-test-card">
            <div className="editor-test-card__header">
              <h2>Regression Checklist</h2>
              <p>每一项都可以直接在当前页面手动验证，不再是泛泛介绍。</p>
            </div>
            <div className="editor-test-checklist">
              {CHECKLIST.map((item) => (
                <div key={item} className="editor-test-checklist__item">
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="editor-test-card">
            <div className="editor-test-card__header">
              <h2>Operator Notes</h2>
              <p>推荐的手动回归顺序，避免漏测关键交互。</p>
            </div>
            <ol className="editor-test-steps">
              <li>
                先切到 `Multi-line Indent`，框选多个 list item 后右键测试
                increase/decrease。
              </li>
              <li>
                再切 `Blocks And Context Actions`，验证 code
                block、math、Adomonition、tabs 的右键菜单。
              </li>
              <li>
                切 `HTML Blocks`，验证 HTML modal
                的实时预览、按钮脚本执行，以及右键 `Modify` 的重编辑能力。
              </li>
              <li>
                切 `Markdown Mode`，进入 Markdown 模式点击 `Email
                Form`，确认会插入 `::custom kind=email-form` 这一类源码指令。
              </li>
              <li>
                切 `Navigation Stress`，点击工具栏里
                `Navigation`，验证长标题目录、独立滚动和跳转定位。
              </li>
              <li>
                最后回到 `Comprehensive Coverage`，重点验证
                image/video/html/formula 与外部 email-form
                的右键行为，以及输出和 renderer preview 没有结构漂移。
              </li>
            </ol>
          </article>

          <article className="editor-test-card">
            <div className="editor-test-card__header">
              <h2>Document Snapshot</h2>
              <p>观察统一文档模型是否和当前编辑行为同步更新。</p>
            </div>
            <pre className="editor-test-code editor-test-code--small">
              {JSON.stringify(documentState, null, 2)}
            </pre>
          </article>
        </aside>
      </section>
    </main>
  );
}
