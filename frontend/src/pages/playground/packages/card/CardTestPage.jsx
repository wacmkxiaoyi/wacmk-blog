import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import { Card } from "../../../../packages/card";
import "./CardTestPage.css";

const releaseTags = ["frontend", "design-system", "playground"];

const reviewSteps = [
  "单独传 content 时应保持简洁容器表现。",
  "content、bottom、side 三块区域可以同时存在，并保持完整矩形轮廓。",
  "bottom 和 side 一旦提供就固定占位，content 只使用剩余区域。",
  "当 contentHeight 与 sideHeight 都传入时，顶部两块会自动对齐为一致高度。",
  "所有区域都只能在自己的尺寸盒子内渲染，内容不会把别的区域顶掉。",
  "桌面端为二维网格，side 插槽可放在左侧或右侧，窄屏自动折叠为单列。",
];

function SoftBadge({ children }) {
  return <span className="card-test-badge">{children}</span>;
}

function MetaPill({ label, value }) {
  return (
    <div className="card-test-meta-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PostLikeContent() {
  return (
    <div className="card-test-post-card">
      <div className="card-test-meta-row">
        <span>产品设计组</span>
        <span>2026-07-12</span>
      </div>
      <h2>基础卡片只关心内容承载，不预设业务字段</h2>
      <p>
        这个示例对应最简单的使用方式。业务层可以自由传入标题、摘要、标签或任意自定义内容，而无需被包内部字段限制。
      </p>
    </div>
  );
}

function PostLikeFooter() {
  return (
    <div className="card-test-footer-row">
      <div className="card-test-tag-row">
        {releaseTags.map((tag) => (
          <SoftBadge key={tag}>#{tag}</SoftBadge>
        ))}
      </div>
      <div className="card-test-feedback-row">
        <span>42 likes</span>
        <span>6 comments</span>
      </div>
    </div>
  );
}

function CoverContent() {
  return (
    <div className="card-test-cover-card">
      <div className="card-test-meta-row card-test-meta-row--light">
        <span>Editor Notes</span>
        <span>Featured</span>
      </div>
      <h2>参考 post-card 的 cover 气质，但保持通用 API</h2>
      <p>
        通过 `tone="cover"`
        提供更强视觉层次，适合活动摘要、精选内容或具有背景图语义的场景。
      </p>
    </div>
  );
}

function BookLikeMain() {
  return (
    <div className="card-test-book-main">
      <div className="card-test-book-eyebrow">Library / Case Study</div>
      <h2>右侧插槽适合承载独立元信息面板</h2>
      <p>
        这个组合参考了 book-list-card
        的信息组织方式。主内容负责标题、摘要和正文说明，右侧插槽只承载日期、状态、计数等辅助信息。
      </p>
      <div className="card-test-tag-row">
        <SoftBadge>14 articles</SoftBadge>
        <SoftBadge>updated today</SoftBadge>
      </div>
    </div>
  );
}

function BookLikeSide() {
  return (
    <div className="card-test-side-panel">
      <MetaPill label="Updated" value="18:40" />
      <MetaPill label="Visibility" value="Internal" />
      <MetaPill label="Owner" value="Platform" />
    </div>
  );
}

function MetricsBottom() {
  return (
    <div className="card-test-bottom-metrics">
      <div className="card-test-bottom-metric">
        <span>阅读完成率</span>
        <strong>84%</strong>
      </div>
      <div className="card-test-bottom-metric">
        <span>最近讨论</span>
        <strong>12 条</strong>
      </div>
      <div className="card-test-bottom-metric">
        <span>同步状态</span>
        <strong>已更新</strong>
      </div>
    </div>
  );
}

export default function CardTestPage() {
  const navigate = useNavigate();
  const [interactiveEnabled, setInteractiveEnabled] = React.useState(true);

  return (
    <main className="card-test-page">
      <section className="card-test-hero">
        <div className="card-test-hero__copy">
          <p className="card-test-eyebrow">/test/frontend/packages/card</p>
          <h1>Card Package Playground</h1>
          <p className="card-test-lead">
            这里集中测试 `frontend/src/packages/card`
            的通用卡片能力。组件只负责容器布局、插槽组织和视觉层，不绑定具体业务字段。
          </p>
        </div>
        <div className="card-test-hero__actions">
          <Button onClick={() => navigate("/home")}>返回首页</Button>
          <Button
            variant="secondary"
            onClick={() => setInteractiveEnabled((current) => !current)}
          >
            {interactiveEnabled ? "关闭 hover 抬升" : "开启 hover 抬升"}
          </Button>
        </div>
      </section>

      <section className="card-test-layout">
        <div className="card-test-main">
          <article className="card-test-section">
            <div className="card-test-section__header">
              <h2>基础内容模式</h2>
              <p>
                只传
                `content`，同时支持单区尺寸指定，也覆盖更窄内容宽度的边界场景。
              </p>
            </div>
            <div className="card-test-card-stack">
              <Card
                interactive={interactiveEnabled}
                contentWidth={520}
                contentHeight={220}
                content={<PostLikeContent />}
              />
              <Card
                interactive={interactiveEnabled}
                tone="soft"
                contentWidth={360}
                contentHeight={210}
                content={<PostLikeContent />}
              />
              <Card
                interactive={interactiveEnabled}
                contentWidth={280}
                contentHeight={220}
                content={<PostLikeContent />}
              />
              <Card
                interactive={interactiveEnabled}
                tone="soft"
                contentWidth={220}
                contentHeight={228}
                content={<PostLikeContent />}
              />
            </div>
          </article>

          <article className="card-test-section">
            <div className="card-test-section__header">
              <h2>下方插槽模式</h2>
              <p>
                适合 post-card
                一类主文案加反馈区、标签区的结构；即使内容偏长，下方区也固定保留。
              </p>
            </div>
            <div className="card-test-card-stack">
              <Card
                interactive={interactiveEnabled}
                tone="soft"
                contentHeight={220}
                bottomHeight={92}
                content={<PostLikeContent />}
                bottomContent={<PostLikeFooter />}
              />
              <Card
                interactive={interactiveEnabled}
                contentWidth={320}
                contentHeight={216}
                bottomHeight={96}
                content={<PostLikeContent />}
                bottomContent={<PostLikeFooter />}
              />
              <Card
                interactive={interactiveEnabled}
                contentWidth={260}
                contentHeight={188}
                bottomHeight={92}
                content={<PostLikeContent />}
                bottomContent={<PostLikeFooter />}
              />
            </div>
          </article>

          <article className="card-test-section">
            <div className="card-test-section__header">
              <h2>侧栏方位模式</h2>
              <p>
                side 插槽默认位于右侧；传入 `sidePosition="left"` 可用于
                book-card 一类左封面、右信息的双栏结构。
              </p>
            </div>
            <div className="card-test-card-stack">
              <Card
                interactive={interactiveEnabled}
                contentWidth="minmax(0, 1.5fr)"
                contentHeight={260}
                sideWidth={220}
                sideHeight={200}
                content={<BookLikeMain />}
                sideContent={<BookLikeSide />}
                sidePosition="left"
              />
              <Card
                interactive={interactiveEnabled}
                contentWidth={260}
                contentHeight={188}
                sideWidth={170}
                sideHeight={240}
                content={<BookLikeMain />}
                sideContent={<BookLikeSide />}
              />
            </div>
          </article>

          <article className="card-test-section">
            <div className="card-test-section__header">
              <h2>三块同时存在</h2>
              <p>主内容、右侧面板、下方信息区可以同时出现，且边界保持齐平。</p>
            </div>
            <div className="card-test-card-stack">
              <Card
                interactive={interactiveEnabled}
                gap={18}
                contentWidth="minmax(0, 2fr)"
                contentHeight={248}
                sideWidth={240}
                sideHeight={192}
                bottomHeight={112}
                content={<BookLikeMain />}
                sideContent={<BookLikeSide />}
                bottomContent={<MetricsBottom />}
              />
              <Card
                interactive={interactiveEnabled}
                gap={14}
                contentWidth={250}
                contentHeight={180}
                sideWidth={180}
                sideHeight={250}
                bottomHeight={96}
                content={<BookLikeMain />}
                sideContent={<BookLikeSide />}
                bottomContent={<MetricsBottom />}
              />
            </div>
          </article>

          <article className="card-test-section">
            <div className="card-test-section__header">
              <h2>Cover 视觉模式</h2>
              <p>用于更强视觉层次的精选卡片，并支持上下组合尺寸控制。</p>
            </div>
            <Card
              interactive={interactiveEnabled}
              tone="cover"
              contentHeight={236}
              bottomHeight={88}
              content={<CoverContent />}
              bottomContent={<PostLikeFooter />}
            />
          </article>
        </div>

        <aside className="card-test-sidebar">
          <section className="card-test-panel">
            <h2>设计约束</h2>
            <div className="card-test-checklist">
              {reviewSteps.map((step) => (
                <div key={step} className="card-test-checklist__item">
                  {step}
                </div>
              ))}
            </div>
          </section>

          <section className="card-test-panel">
            <h2>当前状态</h2>
            <div className="card-test-state-grid">
              <div className="card-test-state-item">
                <span>交互抬升</span>
                <strong>{interactiveEnabled ? "开启" : "关闭"}</strong>
              </div>
              <div className="card-test-state-item">
                <span>插槽组合</span>
                <strong>content / side / bottom 可同时使用</strong>
              </div>
              <div className="card-test-state-item">
                <span>尺寸规则</span>
                <strong>
                  顶部区域自动对齐高度，底部整行铺满，区域固定占位
                </strong>
              </div>
              <div className="card-test-state-item">
                <span>溢出策略</span>
                <strong>内容只在自己的盒子内裁切，不会挤掉下方或右侧</strong>
              </div>
              <div className="card-test-state-item">
                <span>资源策略</span>
                <strong>纯本地 CSS 与文本</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
