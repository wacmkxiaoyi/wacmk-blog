import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import {
  ContentRenderer,
  MarkdownPreset,
  useContentToc,
} from "../../../../packages/content-renderer";
import "./ContentRendererTestPage.css";

const basicMarkdownSource = [
  "# 内容渲染基础场景",
  "",
  "这是一段 **加粗**、*斜体*、~~删除线~~、++下划线++、\`inline-code\` 与 [紫色文字]{.md-color-purple} 混合的说明文本。",
  "",
  "## 列表与引用",
  "",
  "> 统一内容节点模型使 Markdown、富文本和后续来源都能复用同一套 renderer。",
  "",
  "- 支持常规段落与层级标题",
  "- 支持表格、代码块和数学公式",
  "- 支持面向业务扩展的 block 节点",
  "",
  "1. 第一步：解析输入",
  "2. 第二步：运行 plugins",
  "3. 第三步：渲染统一 document",
  "",
  "## 表格与代码",
  "",
  "| 能力 | 当前状态 |",
  "| --- | --- |",
  "| Markdown 输入 | 已支持 |",
  "| Rich Text Document | 已支持 |",
  "| 自定义渲染器 | 已支持 |",
  "",
  String.raw`行内公式示例：\(a^2 + b^2 = c^2\)`,
  "",
  "$$",
  "E = mc^2",
  "$$",
  "",
  "```js",
  "export function greet(name) {",
  String.raw`  return \`Hello, \${name}\`;`,
  "}",
  "```",
].join("\n");

const advancedMarkdownSource = [
  "# 扩展 Block 场景",
  "",
  "> [!TIP] Renderer Playground",
  "> 这个 callout 用于展示 GitHub 风格提示块与标题行。",
  "",
  '???+ note "为什么扩展 block 很重要？"',
  "    因为内容系统往往不仅有正文，还会包含流程提示、嵌入卡片、媒体与交互容器。",
  "",
  '!!! error "渲染失败排查"',
  "    当扩展节点样式或 schema 不一致时，这里应该明显提示阻断性问题。",
  "",
  '=== "说明"',
  "    这一页使用 tabs 验证同一节点内的多面板切换。",
  "",
  '=== "代码"',
  "    ```ts",
  "    export const renderer = {",
  '      mode: "article",',
  '      package: "content-renderer",',
  "    };",
  "    ```",
  "",
  '::video{src="https://www.w3schools.com/html/mov_bbb.mp4" poster="https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217" title="示例视频" muted="true"}',
].join("\n");

const customBlockSource = [
  "# 自定义 Block 场景",
  "",
  "通过 `::custom` 可以把 Markdown 内容接到业务组件上。",
  "",
  '::custom{kind="stat" title="渲染请求" value="18.4k" trend="+12.6%" note="最近 7 天内容页访问量持续上升"}',
  "",
  '::custom{kind="notice" level="beta" message="这个 kind 没有注册组件，用于验证 fallback 表现。"}',
].join("\n");

const wideCodeSource = [
  "# 超长代码块场景",
  "",
  "下面的代码块同时覆盖：",
  "",
  "- `ts` 语法高亮",
  "- 多行内容折叠",
  "- 超宽单行横向滚动",
  "",
  "```ts",
  "type RenderMetric = { route: string; durationMs: number; cache: 'hit' | 'miss'; source: 'markdown' | 'rich-text' };",
  "",
  "const metrics: RenderMetric[] = [",
  "  { route: '/posts/architecture', durationMs: 28, cache: 'hit', source: 'markdown' },",
  "  { route: '/posts/performance', durationMs: 41, cache: 'miss', source: 'markdown' },",
  "  { route: '/guides/content-renderer', durationMs: 34, cache: 'hit', source: 'rich-text' },",
  "];",
  "",
  "export function buildDashboardPayload(environment: 'preview' | 'production') {",
  "  const summary = metrics.reduce((result, entry) => {",
  "    result.total += entry.durationMs;",
  "    result.routes.push(`${entry.route}:${entry.cache}:${entry.source}`);",
  "    return result;",
  "  }, { total: 0, routes: [] as string[] });",
  "",
  "  const average = Number((summary.total / metrics.length).toFixed(2));",
  "  const veryLongLine = 'https://content.example.internal/render?env=' + environment + '&routes=' + summary.routes.join(',') + '&meta=' + encodeURIComponent(JSON.stringify({ generatedAt: '2026-07-04T09:30:00Z', average, owner: 'content-platform', feature: 'syntax-highlight-check', release: '2026.07.04-canary.1' }));",
  "",
  "  return { environment, average, veryLongLine, metrics };",
  "}",
  "",
  "export const payload = buildDashboardPayload('preview');",
  "```",
].join("\n");

const wideTableSource = [
  "# 超长超宽表格场景",
  "",
  "| 页面 | 访问渠道 | 内容类型 | 平均停留时长 | 首屏渲染 | 是否命中缓存 | 实验分组 | 风险备注 | 下一步动作 |",
  "| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |",
  "| /posts/system-design | SEO | longform article | 08:42 | 1.28s | yes | control | 首段代码示例很宽，需要横向滚动但不能挤压正文。 | 保持当前折叠阈值并观察复制按钮位置。 |",
  "| /guides/content-renderer | internal docs | technical guide | 12:17 | 1.41s | no | variant-a | 表格列较多时应优先保留可读性，移动端允许横向滚动。 | 检查 sticky 视觉是否有必要。 |",
  "| /release/2026-07 | newsletter | release notes | 04:33 | 0.94s | yes | control | 图片与表格混排时需要确保间距统一。 | 验证卡片上下节奏。 |",
  "| /playground/content | direct | demo page | 15:09 | 1.73s | no | variant-b | 长备注文本用于触发换行与宽表格滚动场景，同时验证 overlay 按钮不会遮挡最后一列信息。 | 检查超长文本断行策略。 |",
  "| /case-study/editor | social | case study | 06:55 | 1.12s | yes | control | 需要确认偶数行背景在横向滚动时不会出现断层。 | 增加视觉回归截图。 |",
  "| /api/content-schema | direct | reference | 10:21 | 1.36s | yes | variant-a | 列头较长，验证最小宽度下仍然能保持整体结构。 | 检查桌面端和移动端。 |",
  "| /roadmap/q3 | internal | planning | 07:48 | 1.58s | no | variant-c | 行数超过折叠阈值后应出现展开入口。 | 验证 overlay 与滚动容器层级。 |",
  "| /community/highlights | referral | mixed media | 05:40 | 1.07s | yes | control | 图文混合内容页需要统一 hover 和间距节奏。 | 观察表格后的图片表现。 |",
].join("\n");

const imageShowcaseSource = [
  "# 图片场景",
  "",
  "标准 Markdown 图片应保留 alt / title，并保持自适应宽度。",
  "",
  '![紫色渐变封面](https://dummyimage.com/1200x720/e9d5ff/5b21b6.png&text=Content+Renderer+Image "封面示意图")',
  "",
  '![流程示意图](https://dummyimage.com/1200x640/dbeafe/1d4ed8.png&text=Render+Pipeline "渲染流程图")',
].join("\n");

const tocMarkdownSource = String.raw`# 文档目录总览

这一段用于结合 onDocument 与 useContentToc 展示目录抽取结果。

## 安装

安装后可直接使用 MarkdownPreset。

## 渲染模式

支持 article、compact、preview 三种模式。

### 适合完整阅读

article 模式适合正文页。

### 适合密集界面

compact 模式适合管理界面或侧栏。

## 扩展能力

可通过 resolver、component registry 与 adapter registry 扩展。`;

const modeComparisonSource = [
  "## 同一份内容的多模式渲染",
  "",
  "这里保留一段较短内容，用于观察 `article`、`compact`、`preview` 三种模式下的阅读密度。",
  "",
  "- 标题留白",
  "- 段落节奏",
  "- 代码与表格间距",
].join("\n");

const nestedTaskListSource = [
  "# 嵌套任务列表场景",
  "",
  "- [ ] 发布前检查",
  "  需要在发布窗口前确认下列事项。",
  "",
  "  - [x] 内容渲染器支持普通列表",
  "  - [x] 支持 GitHub task list checkbox",
  "  - [ ] 验证嵌套列表在移动端的换行与缩进",
  "    这里是一段续行文本，用于检查 checkbox 后的多行内容是否正确对齐。",
  "  - [ ] 补充回归测试",
  "",
  "- [x] 文档同步",
  "  - [x] 更新 playground 示例",
  "  - [ ] 记录 parser 的已知边界",
  "",
  "1. [ ] 发布流程",
  "   1. [x] 合并功能分支",
  "   2. [ ] 跑完整测试",
].join("\n");

function StatCardCustomBlock({ node }) {
  return (
    <section className="content-renderer-test-custom-card">
      <div className="content-renderer-test-custom-card__eyebrow">
        ::custom / {node.kind}
      </div>
      <div className="content-renderer-test-custom-card__value">
        {node.data?.value}
      </div>
      <h3>{node.data?.title}</h3>
      <p>{node.data?.note}</p>
      <div className="content-renderer-test-custom-card__trend">
        {node.data?.trend}
      </div>
    </section>
  );
}

const richTextDocument = {
  type: "document",
  version: 1,
  format: "rich-text",
  meta: {
    title: "Structured Content Document",
    source: "manual-demo",
  },
  children: [
    {
      type: "heading",
      level: 1,
      id: "rich-structured-document",
      children: [{ type: "text", value: "Structured Content Document" }],
    },
    {
      type: "paragraph",
      children: [
        {
          type: "text",
          value:
            "这个示例不经过 Markdown 解析，直接传统一 document 对象给 renderer。",
        },
      ],
    },
    {
      type: "callout",
      variant: "important",
      title: "直接渲染结构化内容",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value:
                "这说明 renderer 的核心职责是消费统一 schema，而不是依赖某一种输入语法。",
            },
          ],
        },
      ],
    },
    {
      type: "tabs",
      items: [
        {
          type: "tab-item",
          key: "schema",
          label: "Schema",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  value: "BlockNode、InlineNode、TextMark 共同组成渲染输入。",
                },
              ],
            },
          ],
        },
        {
          type: "tab-item",
          key: "runtime",
          label: "Runtime",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  value:
                    "createDocument 负责 adapter parse，runPlugins 负责后处理。",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "table",
      head: {
        type: "table-row",
        cells: [
          {
            type: "table-cell",
            header: true,
            align: "left",
            children: [
              { type: "paragraph", children: [{ type: "text", value: "层" }] },
            ],
          },
          {
            type: "table-cell",
            header: true,
            align: "left",
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", value: "职责" }],
              },
            ],
          },
        ],
      },
      body: [
        {
          type: "table-row",
          cells: [
            {
              type: "table-cell",
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "Adapter" }],
                },
              ],
            },
            {
              type: "table-cell",
              children: [
                {
                  type: "paragraph",
                  children: [
                    { type: "text", value: "把输入格式转为统一 document" },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "table-row",
          cells: [
            {
              type: "table-cell",
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", value: "Renderer" }],
                },
              ],
            },
            {
              type: "table-cell",
              children: [
                {
                  type: "paragraph",
                  children: [
                    { type: "text", value: "根据节点类型输出 React 视图" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      children: [
        {
          type: "text",
          value:
            "同一个 renderer 也可以直接消费 rich-text document，而不依赖 Markdown 输入。",
        },
      ],
    },
    {
      type: "list",
      ordered: false,
      items: [
        {
          type: "list-item",
          checked: false,
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", value: "结构化文档中的父任务" }],
            },
            {
              type: "list",
              ordered: false,
              items: [
                {
                  type: "list-item",
                  checked: true,
                  children: [
                    {
                      type: "paragraph",
                      children: [{ type: "text", value: "已完成子任务" }],
                    },
                  ],
                },
                {
                  type: "list-item",
                  checked: false,
                  children: [
                    {
                      type: "paragraph",
                      children: [
                        { type: "text", value: "待确认移动端缩进与换行" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const richTextDocumentSource = JSON.stringify(richTextDocument, null, 2);

const richTextAdapter = {
  format: "rich-text",
  parse(input) {
    return input;
  },
};

const resolverLabels = {
  download: "下载",
  preview: "预览",
  copy: "复制代码",
  copied: "已复制",
  expand: "展开内容",
  collapse: "收起内容",
  permalink: "标题锚点",
};

const scenarioCards = [
  {
    key: "basic-markdown",
    title: "基础 Markdown",
    description:
      "验证常见正文能力，包括标题、引用、列表、表格、代码块和数学公式。左侧展示原始 markdown，右侧展示解析后的渲染结果。",
    sourceLabel: "Raw Markdown",
    source: basicMarkdownSource,
    render: () => (
      <ContentRenderer
        format="markdown"
        value={basicMarkdownSource}
        adapter={MarkdownPreset.adapter}
        plugins={MarkdownPreset.plugins}
        labels={resolverLabels}
      />
    ),
  },
  {
    key: "extended-blocks",
    title: "扩展 Block 节点",
    description:
      "覆盖 callout、admonition、tabs、video 等扩展节点，验证 package 的核心差异化能力。",
    sourceLabel: "Raw Markdown",
    source: advancedMarkdownSource,
    render: () => (
      <ContentRenderer
        format="markdown"
        value={advancedMarkdownSource}
        adapter={MarkdownPreset.adapter}
        plugins={MarkdownPreset.plugins}
        labels={resolverLabels}
        resolvers={{
          video: (node) => ({
            ...node,
            controls: true,
          }),
        }}
      />
    ),
  },
  {
    key: "custom-blocks",
    title: "::custom 自定义组件",
    description:
      "演示 `::custom` 如何映射到业务组件，同时保留未注册 kind 的 fallback 提示。",
    sourceLabel: "Raw Markdown",
    source: customBlockSource,
    render: () => (
      <ContentRenderer
        format="markdown"
        value={customBlockSource}
        adapter={MarkdownPreset.adapter}
        plugins={MarkdownPreset.plugins}
        labels={resolverLabels}
        customComponents={{
          stat: StatCardCustomBlock,
        }}
      />
    ),
  },
  {
    key: "wide-code",
    title: "超长超宽代码块",
    description:
      "验证 `ts` 语法高亮、长代码折叠、复制按钮与横向滚动在同一场景中的表现。",
    sourceLabel: "Raw Markdown",
    source: wideCodeSource,
    render: () => (
      <ContentRenderer
        format="markdown"
        value={wideCodeSource}
        adapter={MarkdownPreset.adapter}
        plugins={MarkdownPreset.plugins}
        labels={resolverLabels}
      />
    ),
  },
  {
    key: "wide-table",
    title: "超长超宽表格",
    description: "验证多列宽表格的横向滚动，以及超过折叠阈值后的展开交互。",
    sourceLabel: "Raw Markdown",
    source: wideTableSource,
    render: () => (
      <ContentRenderer
        format="markdown"
        value={wideTableSource}
        adapter={MarkdownPreset.adapter}
        plugins={MarkdownPreset.plugins}
        labels={resolverLabels}
      />
    ),
  },
  {
    key: "images",
    title: "图片渲染",
    description: "验证 Markdown 图片的自适应宽度、标题与多图间距表现。",
    sourceLabel: "Raw Markdown",
    source: imageShowcaseSource,
    render: () => (
      <ContentRenderer
        format="markdown"
        value={imageShowcaseSource}
        adapter={MarkdownPreset.adapter}
        plugins={MarkdownPreset.plugins}
        labels={resolverLabels}
      />
    ),
  },
  {
    key: "nested-task-lists",
    title: "嵌套任务列表",
    description:
      "验证 GitHub 风格 checkbox、父子级列表、续行文本，以及 ordered / unordered 混合场景的渲染结果。",
    sourceLabel: "Raw Markdown",
    source: nestedTaskListSource,
    render: () => (
      <ContentRenderer
        format="markdown"
        value={nestedTaskListSource}
        adapter={MarkdownPreset.adapter}
        plugins={MarkdownPreset.plugins}
        labels={resolverLabels}
      />
    ),
  },
  {
    key: "rich-text-document",
    title: "Structured Document 输入",
    description:
      "这个场景不使用 markdown 字符串，而是直接把 JSON document 作为 rich-text 输入，说明 renderer 本身并不与 markdown 强绑定，也可直接渲染结构化的嵌套任务列表。",
    sourceLabel: "Rich Text Document JSON",
    source: richTextDocumentSource,
    render: () => (
      <ContentRenderer
        format="rich-text"
        value={richTextDocument}
        adapter={richTextAdapter}
        labels={resolverLabels}
      />
    ),
  },
];

function TocPreviewCard() {
  const [document, setDocument] = React.useState(null);
  const tocItems = useContentToc(document);

  return (
    <article className="content-renderer-test-card content-renderer-test-card--wide">
      <div className="content-renderer-test-card__header">
        <div>
          <h2>目录与标题锚点</h2>
          <p>
            这个区域结合 `onDocument` 与 `useContentToc`
            抽取标题目录，右侧正文则验证 heading anchor 的表现。
          </p>
        </div>
        <div className="content-renderer-test-card__tag">TOC + Anchors</div>
      </div>

      <div className="content-renderer-test-doc-grid">
        <div className="content-renderer-test-source-panel">
          <div className="content-renderer-test-panel-title">Raw Markdown</div>
          <pre className="content-renderer-test-code">
            <code>{tocMarkdownSource}</code>
          </pre>
        </div>

        <div className="content-renderer-test-render-panel content-renderer-test-render-panel--split">
          <aside className="content-renderer-test-toc-box">
            <div className="content-renderer-test-panel-title">
              Extracted TOC
            </div>
            {tocItems.length ? (
              <ol className="content-renderer-test-toc-list">
                {tocItems.map((item) => (
                  <li
                    key={item.id}
                    className={`content-renderer-test-toc-item content-renderer-test-toc-item--${item.level}`}
                  >
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="content-renderer-test-empty-note">
                等待 document 解析生成目录。
              </div>
            )}
          </aside>

          <div className="content-renderer-test-render-shell">
            <div className="content-renderer-test-panel-title">
              Rendered Result
            </div>
            <ContentRenderer
              format="markdown"
              value={tocMarkdownSource}
              adapter={MarkdownPreset.adapter}
              plugins={MarkdownPreset.plugins}
              labels={resolverLabels}
              onDocument={setDocument}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function ModeComparisonCard() {
  return (
    <article className="content-renderer-test-card content-renderer-test-card--wide">
      <div className="content-renderer-test-card__header">
        <div>
          <h2>渲染模式对比</h2>
          <p>
            同一份 markdown 内容分别使用 `article`、`compact`、`preview`
            三种模式，方便观察阅读密度和节奏差异。
          </p>
        </div>
        <div className="content-renderer-test-card__tag">Modes</div>
      </div>

      <div className="content-renderer-test-doc-grid">
        <div className="content-renderer-test-source-panel">
          <div className="content-renderer-test-panel-title">Raw Markdown</div>
          <pre className="content-renderer-test-code">
            <code>{modeComparisonSource}</code>
          </pre>
        </div>

        <div className="content-renderer-test-mode-grid">
          {[
            { key: "article", title: "Article" },
            { key: "compact", title: "Compact" },
            { key: "preview", title: "Preview" },
          ].map((mode) => (
            <section key={mode.key} className="content-renderer-test-mode-card">
              <div className="content-renderer-test-panel-title">
                {mode.title}
              </div>
              <ContentRenderer
                format="markdown"
                value={modeComparisonSource}
                mode={mode.key}
                adapter={MarkdownPreset.adapter}
                plugins={MarkdownPreset.plugins}
                labels={resolverLabels}
              />
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function ContentRendererTestPage() {
  const navigate = useNavigate();

  return (
    <main className="content-renderer-test-page">
      <section className="content-renderer-test-hero">
        <div className="content-renderer-test-hero__copy">
          <p className="content-renderer-test-eyebrow">
            /test/frontend/packages/content-renderer
          </p>
          <h1>Content Renderer Playground</h1>
          <p className="content-renderer-test-lead">
            这里集中测试 `frontend/src/packages/content-renderer`
            的主要使用场景。每个区域都同时展示原始内容与渲染结果，便于检查
            markdown 解析、扩展 block、语法高亮、TOC 抽取、resolver 以及结构化
            document 输入。
          </p>
        </div>
        <div className="content-renderer-test-hero__actions">
          <Button onClick={() => navigate("/home")}>返回首页</Button>
        </div>
      </section>

      <section className="content-renderer-test-layout">
        <div className="content-renderer-test-main">
          {scenarioCards.map((card) => (
            <article
              key={card.key}
              className="content-renderer-test-card content-renderer-test-card--wide"
            >
              <div className="content-renderer-test-card__header">
                <div>
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </div>
                <div className="content-renderer-test-card__tag">
                  {card.sourceLabel}
                </div>
              </div>

              <div className="content-renderer-test-doc-grid">
                <div className="content-renderer-test-source-panel">
                  <div className="content-renderer-test-panel-title">
                    {card.sourceLabel}
                  </div>
                  <pre className="content-renderer-test-code">
                    <code>{card.source}</code>
                  </pre>
                </div>

                <div className="content-renderer-test-render-panel">
                  <div className="content-renderer-test-panel-title">
                    Rendered Result
                  </div>
                  <div className="content-renderer-test-render-shell">
                    {card.render()}
                  </div>
                </div>
              </div>
            </article>
          ))}

          <TocPreviewCard />
          <ModeComparisonCard />
        </div>

        <aside className="content-renderer-test-sidebar">
          <section className="content-renderer-test-panel">
            <h2>覆盖能力</h2>
            <div className="content-renderer-test-checklist">
              <div className="content-renderer-test-checklist__item">
                MarkdownPreset 的常见正文能力。
              </div>
              <div className="content-renderer-test-checklist__item">
                callout、admonition、tabs、video、custom、image 等扩展 block。
              </div>
              <div className="content-renderer-test-checklist__item">
                代码块语言高亮、复制和长内容折叠。
              </div>
              <div className="content-renderer-test-checklist__item">
                超宽代码块与超宽表格的横向滚动表现。
              </div>
              <div className="content-renderer-test-checklist__item">
                通过 onDocument 与 useContentToc 抽取目录。
              </div>
              <div className="content-renderer-test-checklist__item">
                直接渲染 rich-text document，而不依赖 markdown 输入。
              </div>
            </div>
          </section>

          <section className="content-renderer-test-panel">
            <h2>建议验证点</h2>
            <div className="content-renderer-test-checklist">
              <div className="content-renderer-test-checklist__item">
                标题 hover 时应出现锚点入口，目录项可跳转到对应 heading。
              </div>
              <div className="content-renderer-test-checklist__item">
                tabs 可以切换面板，admonition 可折叠展开。
              </div>
              <div className="content-renderer-test-checklist__item">
                ` ```js `、` ```ts ` 等 fenced code block 应显示不同语法高亮。
              </div>
              <div className="content-renderer-test-checklist__item">
                自定义 `::custom` 组件与 fallback 场景都应可见。
              </div>
              <div className="content-renderer-test-checklist__item">
                rich-text 场景左侧 JSON 与右侧结果应一一对应。
              </div>
              <div className="content-renderer-test-checklist__item">
                移动端下原始内容区与结果区应改为纵向堆叠，不出现不可阅读的压缩布局。
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
