import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import ResourceAccessAuthorizer from "../../../../components/resource-access-authorizer";
import ResourceAccessProvider from "../../../../contexts/ResourceAccessContext";
import useResourceAccess from "../../../../hooks/useResourceAccess";
import "./ResourceAccessAuthorizerTestPage.css";

const makeResource = (type, id, name, context = {}) => ({
  type,
  id,
  name,
  context,
});
const wait = (milliseconds = 350) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const grant = (label) => ({ allGranted: true, label, conditions: [] });

const groups = [
  {
    title: "基础授权结论",
    description:
      "验证组件只信任调用方给出的 allGranted，不自行扫描条件行推导结果。",
    cases: [
      {
        id: "immediate-grant",
        title: "直接通过",
        note: "allGranted=true 时不打开 Modal。",
        resource: makeResource("article", "article-open", "公开设计随笔"),
        decision: grant("公开设计随笔"),
      },
      {
        id: "granted-rows-denied",
        title: "已绿行但整体拒绝",
        note: "条件均通过也不能自行放行。",
        resource: makeResource("book", "book-policy", "策略受限书籍"),
        decision: {
          allGranted: false,
          label: "策略受限书籍",
          conditions: [
            {
              type: "points",
              status: "granted",
              action: "none",
              requirement: 20,
              message: "资源策略仍在审核中。",
            },
          ],
        },
      },
      {
        id: "pending-row-granted",
        title: "待验证行但整体通过",
        note: "整体通过时必须直接返回 true。",
        resource: makeResource(
          "attachment",
          "attachment-record",
          "历史归档.pdf",
        ),
        decision: {
          allGranted: true,
          label: "历史归档.pdf",
          conditions: [
            { type: "encrypted", status: "pending", action: "password" },
          ],
        },
      },
      {
        id: "empty-denied",
        title: "空条件拒绝",
        note: "没有条件且未授权时仍不显示进入。",
        resource: makeResource("video", "video-review", "审核中的视频"),
        decision: { allGranted: false, label: "审核中的视频", conditions: [] },
      },
    ],
  },
  {
    title: "可执行授权流程",
    description:
      "覆盖密码、购买、VIP 折扣、混合条件、失败后重试和子弹窗返回主表。",
    cases: [
      {
        id: "password",
        title: "密码验证与重试",
        note: "密码为 open-sesame；错误后可重新输入。",
        resource: makeResource("article", "article-password", "受保护的文章", {
          source: "article-detail",
        }),
        decision: {
          allGranted: false,
          label: "受保护的文章",
          conditions: [
            {
              id: "secret",
              type: "encrypted",
              status: "pending",
              action: "password",
              requirement: "访问密码",
            },
          ],
        },
      },
      {
        id: "vip-finalize",
        title: "VIP 最终结算",
        note: "展示原价、折后价；确认进入时才结算。",
        resource: makeResource("book", "book-vip", "会员阅读路线", {
          shelf: "premium",
        }),
        decision: {
          allGranted: false,
          canFinalize: true,
          settlementRequired: true,
          label: "会员阅读路线",
          isVip: true,
          conditions: [
            {
              id: "price",
              type: "money",
              status: "purchase_required",
              action: "none",
              originalRequirement: 50,
              discountedRequirement: 40,
              discountApplied: true,
              discountPercent: 20,
              vipLabel: "VIP",
              requirement: 40,
            },
          ],
        },
      },
      {
        id: "mixed",
        title: "密码加最终结算",
        note: "密码通过后才会显示确认进入。",
        resource: makeResource(
          "attachment",
          "attachment-kit",
          "设计资源包.zip",
          { folderId: "assets-2026" },
        ),
        decision: {
          allGranted: false,
          label: "设计资源包.zip",
          conditions: [
            {
              id: "password",
              type: "encrypted",
              status: "pending",
              action: "password",
            },
            {
              id: "price",
              type: "money",
              status: "purchase_required",
              action: "none",
              requirement: 10,
            },
          ],
        },
      },
      {
        id: "password-points-money-ready",
        title: "密码、积分、金币：等待密码",
        note: "积分与余额均满足；密码通过后才允许最终结算。",
        resource: makeResource(
          "article",
          "article-all-conditions-ready",
          "三条件文章",
        ),
        decision: {
          allGranted: false,
          label: "三条件文章",
          conditions: [
            {
              id: "password",
              type: "encrypted",
              status: "pending",
              action: "password",
            },
            {
              id: "points",
              type: "points",
              status: "granted",
              action: "none",
              requirement: 30,
            },
            {
              id: "money",
              type: "money",
              status: "purchase_required",
              action: "none",
              requirement: 20,
            },
          ],
        },
      },
      {
        id: "password-points-money-blocked",
        title: "密码、积分、金币：积分不足",
        note: "密码已通过且余额充足，但积分不足时不能结算。",
        resource: makeResource(
          "book",
          "book-all-conditions-blocked",
          "三条件书籍",
        ),
        decision: {
          allGranted: false,
          label: "三条件书籍",
          conditions: [
            {
              id: "password",
              type: "encrypted",
              status: "granted",
              action: "none",
            },
            {
              id: "points",
              type: "points",
              status: "insufficient_points",
              action: "none",
              requirement: 60,
              message: "积分不足，不能触发最终结算。",
            },
            {
              id: "money",
              type: "money",
              status: "purchase_required",
              action: "none",
              requirement: 25,
            },
          ],
        },
      },
      {
        id: "finalize-retry",
        title: "结算失败后重试",
        note: "首次最终结算失败，第二次成功。",
        resource: makeResource("attachment", "attachment-retry", "授权素材包"),
        decision: {
          allGranted: false,
          canFinalize: true,
          settlementRequired: true,
          label: "授权素材包",
          conditions: [
            {
              id: "price",
              type: "money",
              status: "purchase_required",
              action: "none",
              requirement: 30,
            },
          ],
        },
      },
      {
        id: "invalid-callback",
        title: "回调返回非法决策",
        note: "验证回调返回空对象，子弹窗显示错误并允许取消。",
        resource: makeResource("article", "article-bad-result", "异常响应文章"),
        decision: {
          allGranted: false,
          label: "异常响应文章",
          conditions: [
            {
              id: "password",
              type: "encrypted",
              status: "pending",
              action: "password",
            },
          ],
        },
      },
    ],
  },
  {
    title: "不可执行与扩展规则",
    description:
      "验证余额、积分、书籍上下文、未知类型和缺失回调的保守阻断行为。",
    cases: [
      {
        id: "money-shortage",
        title: "金额不足",
        note: "money 条件无购买动作时显示阻断原因。",
        resource: makeResource("book", "book-money", "高阶创作手册"),
        decision: {
          allGranted: false,
          label: "高阶创作手册",
          conditions: [
            {
              type: "money",
              status: "insufficient_money",
              action: "none",
              requirement: 100,
              message: "当前余额不足，无法购买。",
            },
          ],
        },
      },
      {
        id: "points-shortage",
        title: "积分不足",
        note: "积分条件不应渲染购买入口。",
        resource: makeResource("article", "article-points", "积分专属文章"),
        decision: {
          allGranted: false,
          label: "积分专属文章",
          conditions: [
            {
              type: "points",
              status: "insufficient_points",
              action: "none",
              requirement: 100,
              message: "当前积分不足以满足阅读条件。",
            },
          ],
        },
      },
      {
        id: "book-context",
        title: "书籍上下文",
        note: "context 原样传给回调，组件不解释业务规则。",
        resource: makeResource("article", "article-chapter", "书籍章节", {
          inBook: false,
          parentBookId: "book-12",
        }),
        decision: {
          allGranted: false,
          label: "书籍章节",
          conditions: [
            {
              type: "book_only",
              status: "pending",
              action: "none",
              message: "请从所属书籍中阅读本章节。",
            },
          ],
        },
      },
      {
        id: "custom",
        title: "自定义资源与条件",
        note: "未知资源、状态和 action 不会被默认放行。",
        resource: makeResource("course", "course-a11y", "无障碍课程", {
          organizationId: "team-blue",
        }),
        decision: {
          allGranted: false,
          label: "无障碍课程",
          conditions: [
            {
              type: "license",
              label: "课程许可",
              status: "license_required",
              action: "license",
              requirement: "组织许可",
              message: "该资源需要组织许可证。",
            },
          ],
        },
      },
      {
        id: "missing-password",
        title: "缺少密码回调",
        note: "点击验证会安全结束并记录 unsupported_action。",
        resource: makeResource(
          "attachment",
          "attachment-no-password",
          "未配置验证器的附件",
        ),
        decision: {
          allGranted: false,
          label: "未配置验证器的附件",
          conditions: [
            { type: "encrypted", status: "pending", action: "password" },
          ],
        },
        callbacks: { password: false },
      },
    ],
  },
  {
    title: "数据与并发边界",
    description:
      "覆盖缺失展示数据、无 id 的同类条件、外部权限刷新以及重复调用保护。",
    cases: [
      {
        id: "fallback-label",
        title: "名称回退与长文本",
        note: "缺少 decision.label 时使用 resource.name，并测试长要求文本。",
        resource: makeResource(
          "download",
          "download-long",
          "具有较长名称的本地部署资源包",
        ),
        decision: {
          allGranted: false,
          conditions: [
            {
              type: "license",
              label: "很长的自定义授权条件名称",
              status: "license_required",
              action: "none",
              requirement: "需由组织管理员完成长期许可证配置后才可访问",
              message:
                "这是调用方提供的长说明，用于测试表格换行与移动端横向滚动。",
            },
          ],
        },
      },
      {
        id: "same-type",
        title: "同类型且无 id",
        note: "两个密码条件会得到不同的本地稳定 key。",
        resource: makeResource(
          "article",
          "article-multiple-password",
          "双重加密文章",
        ),
        decision: {
          allGranted: false,
          label: "双重加密文章",
          conditions: [
            { type: "encrypted", status: "pending", action: "password" },
            { type: "encrypted", status: "pending", action: "password" },
          ],
        },
      },
      {
        id: "external-refresh",
        title: "外部刷新权限",
        note: "打开授权表后点击外部刷新，模拟调用方更新 decision。",
        resource: makeResource(
          "attachment",
          "attachment-refresh",
          "实时授权附件",
        ),
        decision: {
          allGranted: false,
          canFinalize: true,
          settlementRequired: true,
          label: "实时授权附件",
          conditions: [
            {
              id: "price",
              type: "money",
              status: "purchase_required",
              action: "none",
              requirement: 8,
            },
          ],
        },
        externalRefresh: true,
      },
      {
        id: "concurrent",
        title: "重复 authorize 调用",
        note: "主弹窗打开时再次调用，第二次应立即返回 false。",
        resource: makeResource("article", "article-concurrent", "并发触发文章"),
        decision: {
          allGranted: false,
          label: "并发触发文章",
          conditions: [
            { type: "encrypted", status: "pending", action: "password" },
          ],
        },
        concurrent: true,
      },
    ],
  },
];

function nextDecision(decision, id) {
  const conditions = decision.conditions.map((condition, index) =>
    (condition.id || `${condition.type}-${index}`) === id
      ? { ...condition, status: "granted", action: "none" }
      : condition,
  );
  const hasPendingSettlement = conditions.some(
    (condition) =>
      condition.type === "money" && condition.status === "purchase_required",
  );
  const nonMoneyGranted = conditions.every(
    (condition) => condition.type === "money" || condition.status === "granted",
  );
  return {
    ...decision,
    conditions,
    allGranted: false,
    canFinalize: hasPendingSettlement && nonMoneyGranted,
    settlementRequired: hasPendingSettlement,
  };
}

function Scenario({ scenario, addLog }) {
  const [decision, setDecision] = useState(scenario.decision);
  const [purchaseAttempts, setPurchaseAttempts] = useState(0);
  const callbacks = scenario.callbacks || {};
  async function verify(payload) {
    addLog(scenario, "password callback", {
      resource: payload.resource,
      condition: payload.condition.type,
      passwordSupplied: Boolean(payload.password),
    });
    await wait();
    if (scenario.id === "invalid-callback") return {};
    if (payload.password !== "open-sesame")
      throw new Error("模拟密码错误，请输入 open-sesame。");
    const updated = nextDecision(decision, payload.condition.id);
    setDecision(updated);
    return updated;
  }
  async function finalize(payload) {
    addLog(scenario, "finalize callback", { resource: payload.resource });
    await wait();
    if (scenario.id === "finalize-retry" && purchaseAttempts === 0) {
      setPurchaseAttempts(1);
      throw new Error("模拟最终结算失败，请再次确认进入。");
    }
    const updated = {
      ...decision,
      allGranted: true,
      canFinalize: false,
      settlementRequired: false,
      conditions: decision.conditions.map((condition) =>
        condition.type === "money"
          ? { ...condition, status: "granted", action: "none" }
          : condition,
      ),
    };
    setDecision(updated);
    return updated;
  }
  const passwordCallback = callbacks.password === false ? undefined : verify;
  return (
    <article className="resource-access-test__scenario">
      <div>
        <h2>{scenario.title}</h2>
        <p>{scenario.note}</p>
        <code>
          {scenario.resource.type} / {scenario.resource.id}
        </code>
      </div>
      <ResourceAccessAuthorizer
        resource={scenario.resource}
        decision={decision}
        onPasswordVerifying={passwordCallback}
        onFinalizing={callbacks.finalize === false ? undefined : finalize}
        onAuthorized={({ decision: authorizedDecision }) =>
          addLog(scenario, "authorized", {
            allGranted: authorizedDecision.allGranted,
          })
        }
        onRejected={({ reason }) => addLog(scenario, "rejected", { reason })}
      >
        {({ authorize, authorizing }) => (
          <div className="resource-access-test__actions">
            <Button
              loading={authorizing}
              onClick={async () => {
                const allowed = await authorize();
                addLog(scenario, "authorize result", { allowed });
              }}
            >
              尝试进入
            </Button>
            {scenario.concurrent ? (
              <Button
                variant="secondary"
                disabled={authorizing}
                onClick={async () => {
                  const first = authorize();
                  const second = await authorize();
                  addLog(scenario, "concurrent result", { second });
                  await first;
                }}
              >
                连续触发两次
              </Button>
            ) : null}
            {scenario.externalRefresh ? (
              <Button
                variant="secondary"
                onClick={() => {
                  const updated = grant("实时授权附件");
                  setDecision(updated);
                  addLog(scenario, "external decision refresh", {
                    allGranted: true,
                  });
                }}
              >
                模拟外部授权刷新
              </Button>
            ) : null}
          </div>
        )}
      </ResourceAccessAuthorizer>
    </article>
  );
}

function InvalidDecisionScenario({ addLog }) {
  const invalidDecision = { allGranted: "yes", conditions: null };
  return (
    <article className="resource-access-test__scenario">
      <div>
        <h2>非法决策输入</h2>
        <p>allGranted 非布尔值且 conditions 非数组；不应打开 Modal。</p>
        <code>article / invalid-decision</code>
      </div>
      <ResourceAccessAuthorizer
        resource={makeResource("article", "invalid-decision", "非法决策资源")}
        decision={invalidDecision}
        onRejected={({ reason }) =>
          addLog(
            { id: "invalid-decision", title: "非法决策输入" },
            "rejected",
            { reason },
          )
        }
      >
        {({ authorize }) => (
          <Button
            onClick={async () =>
              addLog(
                { id: "invalid-decision", title: "非法决策输入" },
                "authorize result",
                { allowed: await authorize() },
              )
            }
          >
            尝试进入
          </Button>
        )}
      </ResourceAccessAuthorizer>
    </article>
  );
}

const providerVipCases = [
  {
    id: "common-private",
    title: "普通用户：普通私密",
    resource: makeResource("book", "801", "独立授权书籍"),
    decision: {
      allGranted: false,
      label: "独立授权书籍",
      accessScope: "standalone",
      effectiveChannel: "common",
      isVip: false,
      conditions: [],
    },
  },
  {
    id: "vip-public",
    title: "VIP：VIP 公开",
    resource: makeResource("book", "802", "独立授权书籍"),
    decision: {
      allGranted: true,
      label: "独立授权书籍",
      accessScope: "standalone",
      effectiveChannel: "vip",
      isVip: true,
      conditions: [],
    },
  },
  {
    id: "vip-conditional",
    title: "VIP：VIP 条件",
    resource: makeResource("book", "803", "独立授权书籍"),
    decision: {
      allGranted: false,
      canFinalize: true,
      settlementRequired: true,
      label: "独立授权书籍",
      accessScope: "standalone",
      effectiveChannel: "vip",
      isVip: true,
      conditions: [
        {
          id: "vip-price",
          type: "money",
          status: "purchase_required",
          action: "none",
          requirement: 40,
          originalRequirement: 50,
          discountedRequirement: 40,
          discountApplied: true,
          discountPercent: 20,
        },
      ],
    },
  },
];

function ProviderVipCase({ item, addLog }) {
  const { authorizeResource } = useResourceAccess();
  return (
    <article className="resource-access-test__scenario">
      <div>
        <h2>{item.title}</h2>
        <p>模拟 resource_access 已按当前用户选择有效通道。</p>
        <code>
          {item.decision.accessScope} / {item.decision.effectiveChannel} / vip=
          {String(item.decision.isVip)}
        </code>
      </div>
      <Button
        onClick={async () =>
          addLog(item, "provider authorize result", {
            allowed: await authorizeResource(item.resource),
            channel: item.decision.effectiveChannel,
          })
        }
      >
        通过 Provider 尝试进入
      </Button>
    </article>
  );
}

function ProviderVipScenarios({ addLog }) {
  const client = {
    check: async (target) =>
      providerVipCases.find((item) => item.resource.id === target.id)?.decision,
    verifyPassword: async () => {
      throw new Error("This mock has no password scenario.");
    },
    finalize: async (target) => {
      const current = providerVipCases.find(
        (item) => item.resource.id === target.id,
      )?.decision;
      return {
        ...current,
        allGranted: true,
        conditions: current.conditions.map((condition) => ({
          ...condition,
          status: "granted",
          action: "none",
        })),
      };
    },
  };
  return (
    <section className="resource-access-test__group">
      <header>
        <h2>Provider 有效授权通道</h2>
        <p>
          使用可注入 mock client 验证 Provider 不重复计算 VIP
          规则，而是消费后端已选择的 common/vip 最终决策。
        </p>
      </header>
      <ResourceAccessProvider client={client}>
        <div className="resource-access-test__grid">
          {providerVipCases.map((item) => (
            <ProviderVipCase key={item.id} item={item} addLog={addLog} />
          ))}
        </div>
      </ResourceAccessProvider>
    </section>
  );
}

export default function ResourceAccessAuthorizerTestPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  function addLog(scenario, event, detail) {
    setLogs((items) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          scenario: scenario.title,
          event,
          detail,
        },
        ...items,
      ].slice(0, 12),
    );
  }
  return (
    <main className="resource-access-test">
      <header className="resource-access-test__header">
        <div>
          <p>/test/frontend/components/resource-access-authorizer</p>
          <h1>Resource Access Authorizer Lab</h1>
          <span>
            纯前端交互验证页。所有权限决策、密码验证和购买操作都由本地回调模拟。
          </span>
        </div>
        <Button variant="secondary" onClick={() => navigate("/home")}>
          返回首页
        </Button>
      </header>
      <section className="resource-access-test__overview">
        <strong>覆盖范围</strong>
        <span>
          授权聚合、密码、购买、VIP、缺失回调、失败重试、未知规则、上下文、非法输入、外部刷新、并发与响应式布局。
        </span>
      </section>
      <section className="resource-access-test__log" aria-live="polite">
        <div>
          <h2>交互日志</h2>
          <Button variant="secondary" onClick={() => setLogs([])}>
            清空
          </Button>
        </div>
        {logs.length ? (
          <ol>
            {logs.map((item) => (
              <li key={item.id}>
                <time>{item.time}</time>
                <strong>{item.scenario}</strong>
                <span>{item.event}</span>
                <code>{JSON.stringify(item.detail)}</code>
              </li>
            ))}
          </ol>
        ) : (
          <p>等待交互。主弹窗关闭会记录 rejected；子弹窗关闭只返回主授权表。</p>
        )}
      </section>
      {groups.map((group) => (
        <section key={group.title} className="resource-access-test__group">
          <header>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
          </header>
          <div className="resource-access-test__grid">
            {group.cases.map((scenario) => (
              <Scenario key={scenario.id} scenario={scenario} addLog={addLog} />
            ))}
            {group.title === "数据与并发边界" ? (
              <InvalidDecisionScenario addLog={addLog} />
            ) : null}
          </div>
        </section>
      ))}
      <ProviderVipScenarios addLog={addLog} />
      <section className="resource-access-test__guide">
        <h2>测试提示</h2>
        <p>
          密码为 <code>open-sesame</code>。请分别验证子弹窗
          Cancel、右上角关闭、Esc 和遮罩点击仅返回主权限表；主弹窗的
          Cancel、关闭、Esc 和遮罩点击则会令 <code>authorize()</code> 返回{" "}
          <code>false</code>。
        </p>
      </section>
    </main>
  );
}
