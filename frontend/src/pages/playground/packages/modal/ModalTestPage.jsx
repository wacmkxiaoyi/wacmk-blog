import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import Input from "../../../../components/ui/Input";
import { Modal } from "../../../../packages/modal";
import "./ModalTestPage.css";

const toneOptions = [
  {
    key: "normal",
    label: "Normal",
    description: "默认无强调，适合普通确认与表单场景。",
  },
  {
    key: "info",
    label: "Info",
    description: "信息提示，适合说明、引导和下一步操作。",
  },
  {
    key: "success",
    label: "Success",
    description: "成功反馈，适合保存完成或流程结束。",
  },
  {
    key: "warning",
    label: "Warning",
    description: "需要再次确认，适合有风险但可恢复的操作。",
  },
  {
    key: "error",
    label: "Error",
    description: "高风险提醒，适合删除、覆盖和不可逆行为。",
  },
];

const sizeOptions = [
  {
    key: "sm",
    label: "Small",
    description: "紧凑型弹窗，适合短文本与简单确认。",
  },
  {
    key: "md",
    label: "Medium",
    description: "通用型弹窗，适合大多数表单与说明。",
  },
  {
    key: "wide",
    label: "Wide",
    description: "宽版内容区，适合复杂布局与预览。",
  },
  {
    key: "table",
    label: "Table",
    description: "适合包含表格、列表和多列信息。",
  },
  {
    key: "attachmentBrowser",
    label: "Attachment",
    description: "适合附件浏览器类的大内容区域。",
  },
];

const behaviorOptions = [
  {
    key: "locked",
    label: "禁止遮罩与 Esc 关闭",
    title: "Locked modal",
    description: "只能通过操作按钮显式关闭，可用于关键步骤确认。",
    props: {
      closeOnBackdrop: false,
      closeOnEsc: false,
      showCloseButton: true,
    },
  },
  {
    key: "no-close-button",
    label: "隐藏右上角关闭按钮",
    title: "Hidden close button",
    description: "保留遮罩和 Esc 关闭，但移除标题栏关闭按钮。",
    props: {
      closeOnBackdrop: true,
      closeOnEsc: true,
      showCloseButton: false,
    },
  },
];

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function ModalTestPage() {
  const navigate = useNavigate();
  const [basicOpen, setBasicOpen] = React.useState(false);
  const [toneOpen, setToneOpen] = React.useState(false);
  const [activeTone, setActiveTone] = React.useState(toneOptions[0]);
  const [sizeOpen, setSizeOpen] = React.useState(false);
  const [activeSize, setActiveSize] = React.useState(sizeOptions[1]);
  const [behaviorOpen, setBehaviorOpen] = React.useState(false);
  const [activeBehavior, setActiveBehavior] = React.useState(
    behaviorOptions[0],
  );
  const [asyncOpen, setAsyncOpen] = React.useState(false);
  const [asyncResult, setAsyncResult] = React.useState("尚未执行异步操作。");
  const [keepOpen, setKeepOpen] = React.useState(false);
  const [keepOpenMessage, setKeepOpenMessage] = React.useState(
    "点击“校验但不关闭”后，这个 modal 会保持打开状态。",
  );
  const [nestedOpen, setNestedOpen] = React.useState(false);
  const [nestedChildOpen, setNestedChildOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [longContentOpen, setLongContentOpen] = React.useState(false);
  const [wideContentOpen, setWideContentOpen] = React.useState(false);
  const [dangerOpen, setDangerOpen] = React.useState(false);
  const [formState, setFormState] = React.useState({
    name: "Modal playground",
    owner: "frontend",
    notes: "在这里测试复杂内容、输入焦点和滚动表现。",
  });
  const [formFeedback, setFormFeedback] = React.useState("未提交");

  function openToneModal(toneKey) {
    const tone =
      toneOptions.find((option) => option.key === toneKey) || toneOptions[0];
    setActiveTone(tone);
    setToneOpen(true);
  }

  function openSizeModal(sizeKey) {
    const size =
      sizeOptions.find((option) => option.key === sizeKey) || sizeOptions[1];
    setActiveSize(size);
    setSizeOpen(true);
  }

  function openBehaviorModal(behaviorKey) {
    const behavior =
      behaviorOptions.find((option) => option.key === behaviorKey) ||
      behaviorOptions[0];
    setActiveBehavior(behavior);
    setBehaviorOpen(true);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return (
    <main className="modal-test-page">
      <section className="modal-test-hero">
        <div className="modal-test-hero__copy">
          <p className="modal-test-eyebrow">/test/frontend/packages/modal</p>
          <h1>Modal Package Playground</h1>
          <p className="modal-test-lead">
            这里集中测试 `frontend/src/packages/modal` 的主要能力，包括不同
            tone、size、行为开关、 异步 action、keepOpen 和嵌套 modal 堆栈。
          </p>
        </div>
        <div className="modal-test-hero__actions">
          <Button onClick={() => navigate("/home")}>返回首页</Button>
          <Button variant="secondary" onClick={() => setBasicOpen(true)}>
            打开基础示例
          </Button>
        </div>
      </section>

      <section className="modal-test-grid">
        <article className="modal-test-card">
          <div className="modal-test-card__header">
            <h2>基础与内容</h2>
            <p>验证默认结构、文案排版和一般操作按钮。</p>
          </div>
          <div className="modal-test-button-list">
            <Button onClick={() => setBasicOpen(true)}>Basic modal</Button>
            <Button variant="secondary" onClick={() => setFormOpen(true)}>
              Form content modal
            </Button>
            <Button
              variant="secondary"
              onClick={() => setLongContentOpen(true)}
            >
              Long content modal
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWideContentOpen(true)}
            >
              Wide content modal
            </Button>
          </div>
        </article>

        <article className="modal-test-card">
          <div className="modal-test-card__header">
            <h2>Tone</h2>
            <p>检查不同语义色与标题区呈现是否符合预期。</p>
          </div>
          <div className="modal-test-button-list modal-test-button-list--stacked">
            {toneOptions.map((tone) => (
              <Button
                key={tone.key}
                variant={tone.key === "normal" ? "secondary" : "primary"}
                onClick={() => openToneModal(tone.key)}
              >
                {tone.label}
              </Button>
            ))}
          </div>
        </article>

        <article className="modal-test-card">
          <div className="modal-test-card__header">
            <h2>Size</h2>
            <p>检查不同宽度规格在桌面和移动端下的表现。</p>
          </div>
          <div className="modal-test-button-list modal-test-button-list--stacked">
            {sizeOptions.map((size) => (
              <Button
                key={size.key}
                variant={size.key === "md" ? "primary" : "secondary"}
                onClick={() => openSizeModal(size.key)}
              >
                {size.label}
              </Button>
            ))}
          </div>
        </article>

        <article className="modal-test-card">
          <div className="modal-test-card__header">
            <h2>行为开关</h2>
            <p>验证遮罩点击、Esc 关闭和关闭按钮的边界行为。</p>
          </div>
          <div className="modal-test-button-list modal-test-button-list--stacked">
            {behaviorOptions.map((behavior) => (
              <Button
                key={behavior.key}
                variant="secondary"
                onClick={() => openBehaviorModal(behavior.key)}
              >
                {behavior.label}
              </Button>
            ))}
          </div>
        </article>

        <article className="modal-test-card">
          <div className="modal-test-card__header">
            <h2>Action 状态</h2>
            <p>检查异步 loading、danger、ghost 和 keepOpen 表现。</p>
          </div>
          <div className="modal-test-button-list">
            <Button onClick={() => setAsyncOpen(true)}>Async action</Button>
            <Button variant="secondary" onClick={() => setKeepOpen(true)}>
              keepOpen action
            </Button>
            <Button variant="secondary" onClick={() => setDangerOpen(true)}>
              Danger and ghost
            </Button>
          </div>
        </article>

        <article className="modal-test-card modal-test-card--wide">
          <div className="modal-test-card__header">
            <h2>嵌套堆栈</h2>
            <p>
              验证父子 modal 同时存在时，焦点、Esc 和遮罩事件只作用于最上层。
            </p>
          </div>
          <div className="modal-test-button-list">
            <Button onClick={() => setNestedOpen(true)}>
              Open nested modals
            </Button>
          </div>
          <div className="modal-test-note-list">
            <div className="modal-test-note">
              先打开父层 modal，再通过主按钮打开第二层 modal。
            </div>
            <div className="modal-test-note">
              关闭第二层后，第一层的状态和内容应保持不变。
            </div>
            <div className="modal-test-note">
              按 Esc 或点击 modal 外部时，只应取消并关闭当前最上层的 modal。
            </div>
          </div>
        </article>
      </section>

      <Modal
        open={basicOpen}
        onOpenChange={setBasicOpen}
        kicker="Basic"
        title="基础 modal 示例"
        tone="normal"
        size="md"
        labels={{ cancel: "关闭", confirm: "确认继续" }}
        actions={[
          {
            key: "cancel",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "confirm",
            label: "确认继续",
            variant: "primary",
            autoFocus: true,
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content">
          <p>
            这是最基础的弹窗内容，用来检查标题、正文、底部 actions
            和默认焦点是否正常。
          </p>
          <p>
            如果你直接按回车，应该会触发主按钮，因为它被标记为 `autoFocus`。
          </p>
        </div>
      </Modal>

      <Modal
        open={toneOpen}
        onOpenChange={setToneOpen}
        kicker="Tone"
        title={`${activeTone.label} modal`}
        tone={activeTone.key}
        size="md"
        labels={{ confirm: "知道了" }}
        actions={[
          {
            key: "tone-close",
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content">
          <p>{activeTone.description}</p>
          <div className="modal-test-preview-pill">
            当前 tone: {activeTone.key}
          </div>
        </div>
      </Modal>

      <Modal
        open={sizeOpen}
        onOpenChange={setSizeOpen}
        kicker="Size"
        title={`${activeSize.label} modal`}
        tone="info"
        size={activeSize.key}
        labels={{ cancel: "关闭", confirm: "主操作" }}
        actions={[
          {
            key: "size-cancel",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "size-confirm",
            label: "主操作",
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content modal-test-content--spacious">
          <p>{activeSize.description}</p>
          <div className="modal-test-preview-grid">
            <div className="modal-test-preview-box">Preview A</div>
            <div className="modal-test-preview-box">Preview B</div>
            <div className="modal-test-preview-box">Preview C</div>
            <div className="modal-test-preview-box">Preview D</div>
          </div>
        </div>
      </Modal>

      <Modal
        open={behaviorOpen}
        onOpenChange={setBehaviorOpen}
        kicker="Behavior"
        title={activeBehavior.title}
        tone="warning"
        size="sm"
        closeOnBackdrop={activeBehavior.props.closeOnBackdrop}
        closeOnEsc={activeBehavior.props.closeOnEsc}
        showCloseButton={activeBehavior.props.showCloseButton}
        labels={{ cancel: "返回", confirm: "关闭 modal" }}
        actions={[
          {
            key: "behavior-back",
            variant: "ghost",
            label: "返回",
            onClick: ({ close }) => close(),
          },
          {
            key: "behavior-confirm",
            label: "关闭 modal",
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content">
          <p>{activeBehavior.description}</p>
          <p>
            当前配置: backdrop {String(activeBehavior.props.closeOnBackdrop)} /
            esc {String(activeBehavior.props.closeOnEsc)} / close button{" "}
            {String(activeBehavior.props.showCloseButton)}
          </p>
        </div>
      </Modal>

      <Modal
        open={asyncOpen}
        onOpenChange={setAsyncOpen}
        kicker="Async"
        title="异步 action 示例"
        tone="info"
        size="sm"
        labels={{ cancel: "取消" }}
        actions={[
          {
            key: "async-cancel",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "async-submit",
            label: "模拟 1.2 秒请求",
            loadingLabel: "请求中...",
            variant: "primary",
            onClick: async () => {
              setAsyncResult("请求执行中，请观察主按钮 loading 状态...");
              await wait(1200);
              setAsyncResult(
                `异步操作完成于 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`,
              );
            },
          },
        ]}
      >
        <div className="modal-test-content">
          <p>
            点击主按钮后，modal action 会进入 loading，并在 Promise
            完成后自动关闭。
          </p>
          <div className="modal-test-inline-feedback">{asyncResult}</div>
        </div>
      </Modal>

      <Modal
        open={keepOpen}
        onOpenChange={(open) => {
          setKeepOpen(open);
          if (!open) {
            setKeepOpenMessage(
              "点击“校验但不关闭”后，这个 modal 会保持打开状态。",
            );
          }
        }}
        kicker="keepOpen"
        title="保持打开的 action"
        tone="success"
        size="md"
        labels={{ confirm: "完成并关闭" }}
        actions={[
          {
            key: "keep-open-check",
            label: "校验但不关闭",
            variant: "secondary",
            keepOpen: true,
            onClick: async () => {
              setKeepOpenMessage(
                "校验通过，modal 仍保持打开，说明 keepOpen 生效。",
              );
              await wait(600);
            },
          },
          {
            key: "keep-open-close",
            label: "完成并关闭",
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content">
          <p>这个场景用于验证 action 执行完成后不会自动关闭 modal。</p>
          <div className="modal-test-inline-feedback">{keepOpenMessage}</div>
        </div>
      </Modal>

      <Modal
        open={nestedOpen}
        onOpenChange={(open) => {
          setNestedOpen(open);
          if (!open) {
            setNestedChildOpen(false);
          }
        }}
        kicker="Parent"
        title="第一层 modal"
        tone="info"
        size="md"
        labels={{ cancel: "关闭父层" }}
        actions={[
          {
            key: "nested-close-parent",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "nested-open-child",
            label: "打开第二层",
            variant: "primary",
            keepOpen: true,
            onClick: () => setNestedChildOpen(true),
          },
        ]}
      >
        <div className="modal-test-content">
          <p>父层 modal 在子层打开后应继续保留，不应被卸载或重置。</p>
          <div className="modal-test-inline-feedback">
            当前子层状态: {nestedChildOpen ? "已打开" : "未打开"}
          </div>
        </div>
      </Modal>

      <Modal
        open={nestedChildOpen}
        onOpenChange={setNestedChildOpen}
        kicker="Child"
        title="第二层 modal"
        tone="success"
        size="sm"
        labels={{ confirm: "关闭当前层" }}
        actions={[
          {
            key: "nested-close-child",
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content">
          <p>现在请尝试按 Esc 或点击遮罩，确认只会影响最上层的第二个 modal。</p>
        </div>
      </Modal>

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        kicker="Form"
        title="复杂内容与输入焦点"
        tone="normal"
        size="wide"
        labels={{ cancel: "取消", confirm: "保存草稿" }}
        actions={[
          {
            key: "form-cancel",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "form-save",
            label: "保存草稿",
            variant: "primary",
            onClick: ({ close }) => {
              setFormFeedback(
                `最近一次保存: ${formState.name} / ${formState.owner}`,
              );
              close();
            },
          },
        ]}
      >
        <div className="modal-test-form-layout">
          <p className="modal-test-form-tip">
            现在输入框和 textarea 可以正常编辑，按 Enter 不会误触发底部主操作。
          </p>
          <Input
            label="名称"
            name="name"
            value={formState.name}
            onChange={handleFormChange}
            placeholder="输入这次测试的名称"
          />
          <Input
            label="负责人"
            name="owner"
            value={formState.owner}
            onChange={handleFormChange}
            placeholder="比如 frontend / admin"
          />
          <label
            className="modal-test-textarea-group"
            htmlFor="modal-test-notes"
          >
            <span>备注</span>
            <textarea
              id="modal-test-notes"
              name="notes"
              value={formState.notes}
              onChange={handleFormChange}
              placeholder="测试滚动、回车键、输入状态和内容区高度"
            />
          </label>
          <div className="modal-test-inline-feedback">{formFeedback}</div>
        </div>
      </Modal>

      <Modal
        open={longContentOpen}
        onOpenChange={setLongContentOpen}
        kicker="Overflow"
        title="超长内容纵向滚动测试"
        tone="info"
        size="table"
        labels={{ cancel: "关闭", confirm: "滚动到底再关闭" }}
        actions={[
          {
            key: "long-close-secondary",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "long-close-primary",
            label: "滚动到底再关闭",
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content modal-test-content--spacious">
          <p>
            这个场景用于测试 modal body 的纵向滚动、长列表阅读体验，以及
            header/footer 在长内容下的表现。
          </p>
          <div className="modal-test-long-list">
            {Array.from({ length: 18 }, (_, index) => (
              <section
                key={`long-item-${index + 1}`}
                className="modal-test-long-card"
              >
                <h3>Section {index + 1}</h3>
                <p>
                  这一段用于制造真实的长内容滚动。你可以连续滚动，观察 modal
                  body 的滚动条、滚动惯性以及底部 actions 是否保持在预期位置。
                </p>
                <p>
                  同时也可以在移动端查看内容折行、段落间距和滚动时的视觉稳定性。当前卡片索引为{" "}
                  {index + 1}。
                </p>
              </section>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={wideContentOpen}
        onOpenChange={setWideContentOpen}
        kicker="Overflow"
        title="超宽内容横向滚动测试"
        tone="warning"
        size="table"
        labels={{ cancel: "关闭", confirm: "已验证" }}
        actions={[
          {
            key: "wide-close-secondary",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "wide-close-primary",
            label: "已验证",
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content modal-test-content--spacious">
          <p>
            这个场景用于测试 modal body
            的横向滚动，以及横向和纵向滚动条同时存在时的交互表现。
          </p>
          <div className="modal-test-wide-shell">
            <table className="modal-test-wide-table">
              <thead>
                <tr>
                  <th>Column A</th>
                  <th>Column B</th>
                  <th>Column C</th>
                  <th>Column D</th>
                  <th>Column E</th>
                  <th>Column F</th>
                  <th>Column G</th>
                  <th>Column H</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }, (_, rowIndex) => (
                  <tr key={`wide-row-${rowIndex + 1}`}>
                    <td>
                      Row {rowIndex + 1} / Alpha content block with a
                      deliberately longer value
                    </td>
                    <td>Beta status {rowIndex + 1}</td>
                    <td>
                      Gamma payload preview for modal horizontal scroll
                      verification
                    </td>
                    <td>Delta owner frontend-admin-{rowIndex + 1}</td>
                    <td>
                      Epsilon timestamp 2026-07-01 18:
                      {String(rowIndex).padStart(2, "0")}:00
                    </td>
                    <td>
                      Zeta column contains a wider sentence to force the table
                      beyond the container width
                    </td>
                    <td>Eta metrics 1280 x 720 / 1440 x 900 / 1920 x 1080</td>
                    <td>
                      Theta notes with additional descriptive text for overflow
                      validation
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-test-inline-feedback">
            请同时测试：左右滚动、上下滚动、触控板横向滚动，以及小屏状态下的滚动条可见性。
          </div>
        </div>
      </Modal>

      <Modal
        open={dangerOpen}
        onOpenChange={setDangerOpen}
        kicker="Variants"
        title="Danger 与 ghost action"
        tone="error"
        size="sm"
        actions={[
          {
            key: "danger-dismiss",
            label: "稍后处理",
            variant: "ghost",
            onClick: ({ close }) => close(),
          },
          {
            key: "danger-disabled",
            label: "禁用操作",
            variant: "secondary",
            disabled: true,
          },
          {
            key: "danger-confirm",
            label: "确认删除",
            variant: "danger",
            autoFocus: true,
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="modal-test-content">
          <p>
            这个示例用于检查 `danger`、`ghost`、`disabled` 和 `autoFocus` 在
            footer actions 里的表现。
          </p>
        </div>
      </Modal>
    </main>
  );
}
