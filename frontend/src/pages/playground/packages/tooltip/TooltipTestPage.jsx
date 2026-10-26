import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import Input from "../../../../components/ui/Input";
import { Tooltip } from "../../../../packages/tooltip";
import "./TooltipTestPage.css";

const releaseTips = [
  { key: "status", label: "当前状态", value: "Ready for internal review" },
  { key: "owner", label: "负责人", value: "frontend-platform" },
  { key: "window", label: "发布时间窗", value: "2026-07-15 19:30" },
];

const edgeCases = [
  {
    key: "top-edge",
    title: "顶部边缘",
    description: "默认 placement 为 top，但顶部空间不足时应自动翻到底部。",
    className: "tooltip-test-edge tooltip-test-edge--top",
  },
  {
    key: "bottom-edge",
    title: "底部边缘",
    description: "默认 placement 为 bottom，但底部空间不足时应自动翻到顶部。",
    className: "tooltip-test-edge tooltip-test-edge--bottom",
  },
];

function ReleaseTooltipContent() {
  return (
    <div className="tooltip-test-release-card">
      <div>
        <strong>Release window</strong>
        <p>用于测试自定义宽度、复杂信息排版和高 z-index 浮层表现。</p>
      </div>
      <div className="tooltip-test-release-grid">
        {releaseTips.map((item) => (
          <div key={item.key} className="tooltip-test-release-row">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TooltipTestPage() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = React.useState("尚未与 tooltip 内部交互。");
  const [noteDraft, setNoteDraft] = React.useState(
    "hover 后可继续把鼠标移动到 tooltip 面板内部进行点击与输入。",
  );
  const [interactiveCount, setInteractiveCount] = React.useState(0);

  function handleInteractiveClick() {
    setInteractiveCount((current) => {
      const nextCount = current + 1;
      setFeedback(`已点击 tooltip 内部按钮 ${nextCount} 次。`);
      return nextCount;
    });
  }

  return (
    <main className="tooltip-test-page">
      <section className="tooltip-test-hero">
        <div className="tooltip-test-hero__copy">
          <p className="tooltip-test-eyebrow">
            /test/frontend/packages/tooltip
          </p>
          <h1>Tooltip Package Playground</h1>
          <p className="tooltip-test-lead">
            这里集中测试 `frontend/src/packages/tooltip` 的 hover
            浮层能力，包括上方/下方定位、自动翻转、
            自定义宽高、背景色、可交互内容以及较高 z-index 的 portal 渲染表现。
          </p>
        </div>
        <div className="tooltip-test-hero__actions">
          <Button onClick={() => navigate("/home")}>返回首页</Button>
        </div>
      </section>

      <section className="tooltip-test-layout">
        <div className="tooltip-test-main">
          <article className="tooltip-test-card">
            <div className="tooltip-test-card__header">
              <h2>基础与方向</h2>
              <p>验证 top、bottom 两种常用方向和默认黑色背景。</p>
            </div>
            <div className="tooltip-test-inline-row">
              <Tooltip content={<span>默认 top tooltip，适合简短说明。</span>}>
                <button type="button" className="tooltip-test-chip">
                  Hover top
                </button>
              </Tooltip>
              <Tooltip
                placement="bottom"
                content={<span>这里强制使用 bottom placement。</span>}
              >
                <button
                  type="button"
                  className="tooltip-test-chip tooltip-test-chip--soft"
                >
                  Hover bottom
                </button>
              </Tooltip>
              <Tooltip width={320} content={<ReleaseTooltipContent />}>
                <button
                  type="button"
                  className="tooltip-test-chip tooltip-test-chip--accent"
                >
                  宽版 tooltip
                </button>
              </Tooltip>
            </div>
          </article>

          <article className="tooltip-test-card">
            <div className="tooltip-test-card__header">
              <h2>自定义样式</h2>
              <p>验证宽度、高度、背景色和较大 z-index 在复杂容器中的呈现。</p>
            </div>
            <div className="tooltip-test-style-grid">
              <div className="tooltip-test-overflow-shell">
                <div className="tooltip-test-overflow-banner">
                  容器故意设置了 overflow: hidden
                </div>
                <Tooltip
                  width={260}
                  height={148}
                  zIndex={3200}
                  backgroundColor="#251537"
                  content={
                    <div className="tooltip-test-color-card">
                      <strong>Portal verification</strong>
                      <p>
                        即使外层容器裁切内容，tooltip 也应悬浮在其外部完整显示。
                      </p>
                    </div>
                  }
                >
                  <button type="button" className="tooltip-test-card-button">
                    检查 overflow 场景
                  </button>
                </Tooltip>
              </div>

              <div className="tooltip-test-palette-grid">
                <Tooltip
                  width={220}
                  backgroundColor="#14323d"
                  content={<span>深青色背景，可用于状态说明或辅助信息。</span>}
                >
                  <button
                    type="button"
                    className="tooltip-test-swatch tooltip-test-swatch--cyan"
                  >
                    #14323d
                  </button>
                </Tooltip>
                <Tooltip
                  width={220}
                  backgroundColor="#4f1d3f"
                  content={
                    <span>深莓色背景，用于更贴近当前项目视觉语言的预览。</span>
                  }
                >
                  <button
                    type="button"
                    className="tooltip-test-swatch tooltip-test-swatch--berry"
                  >
                    #4f1d3f
                  </button>
                </Tooltip>
              </div>
            </div>
          </article>

          <article className="tooltip-test-card">
            <div className="tooltip-test-card__header">
              <h2>交互型内容</h2>
              <p>
                tooltip 内支持点击和输入，鼠标从触发元素移入面板后不应立刻关闭。
              </p>
            </div>
            <div className="tooltip-test-inline-row">
              <Tooltip
                width={320}
                backgroundColor="#101828"
                content={
                  <div className="tooltip-test-interactive-card">
                    <p className="tooltip-test-interactive-title">
                      Quick actions
                    </p>
                    <p className="tooltip-test-interactive-text">
                      点击按钮后会直接更新当前页面状态，验证 tooltip 可交互。
                    </p>
                    <div className="tooltip-test-interactive-actions">
                      <Button
                        variant="secondary"
                        onClick={handleInteractiveClick}
                      >
                        记录一次操作
                      </Button>
                    </div>
                    <div className="tooltip-test-inline-feedback">
                      {feedback}
                    </div>
                  </div>
                }
              >
                <button
                  type="button"
                  className="tooltip-test-chip tooltip-test-chip--dark"
                >
                  Hover 可交互内容
                </button>
              </Tooltip>

              <Tooltip
                width={340}
                backgroundColor="#15151f"
                content={
                  <div className="tooltip-test-form-card">
                    <p className="tooltip-test-interactive-title">
                      Inline note editor
                    </p>
                    <Input
                      label="Tooltip Note"
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                    />
                    <div className="tooltip-test-inline-feedback">
                      当前内容：{noteDraft}
                    </div>
                  </div>
                }
              >
                <button
                  type="button"
                  className="tooltip-test-chip tooltip-test-chip--outline"
                >
                  Hover 内嵌输入框
                </button>
              </Tooltip>
            </div>
          </article>

          <article className="tooltip-test-card tooltip-test-card--wide">
            <div className="tooltip-test-card__header">
              <h2>边缘自动翻转</h2>
              <p>
                把触发点放到页面接近顶部和底部的位置，检查 tooltip
                会根据剩余空间自动切换朝向。
              </p>
            </div>
            <div className="tooltip-test-edge-stage">
              {edgeCases.map((edgeCase) => (
                <Tooltip
                  key={edgeCase.key}
                  placement={edgeCase.key === "bottom-edge" ? "bottom" : "top"}
                  width={280}
                  content={<span>{edgeCase.description}</span>}
                >
                  <button type="button" className={edgeCase.className}>
                    {edgeCase.title}
                  </button>
                </Tooltip>
              ))}
            </div>
          </article>
        </div>

        <aside className="tooltip-test-sidebar">
          <section className="tooltip-test-panel">
            <h2>验收建议</h2>
            <div className="tooltip-test-checklist">
              <div className="tooltip-test-checklist__item">
                基础 hover 时 tooltip 应在目标上方或下方显示。
              </div>
              <div className="tooltip-test-checklist__item">
                将鼠标移入 tooltip 面板后，浮层应保持可见并允许点击。
              </div>
              <div className="tooltip-test-checklist__item">
                页面滚动或窗口 resize 后，tooltip 应关闭，避免残留错位。
              </div>
              <div className="tooltip-test-checklist__item">
                接近页面边缘时应自动翻转，不应溢出视口。
              </div>
            </div>
          </section>

          <section className="tooltip-test-panel">
            <h2>交互状态</h2>
            <div className="tooltip-test-status-grid">
              <div className="tooltip-test-status-item">
                <span>内部按钮点击次数</span>
                <strong>{interactiveCount}</strong>
              </div>
              <div className="tooltip-test-status-item">
                <span>最后反馈</span>
                <strong>{feedback}</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
