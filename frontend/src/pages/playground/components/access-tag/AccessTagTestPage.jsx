import { useNavigate } from "react-router-dom";
import AccessTag from "../../../../components/access-tag/AccessTag";
import Button from "../../../../components/ui/Button";
import "./AccessTagTestPage.css";

const cases = [
  {
    title: "基础可见性",
    description: "公开、私密以及附带 VIP 标识的单一权限。",
    tags: [
      <AccessTag key="public" type="public" />,
      <AccessTag key="private" type="private" />,
      <AccessTag key="vip-private" type="private" isVIP />,
    ],
  },
  {
    title: "单个条件",
    description: "一个条件直接显示自身图标和完整文本。",
    tags: [
      <AccessTag
        key="money"
        type="conditional"
        value={[{ type: "money", value: 10 }]}
      />,
      <AccessTag
        key="points"
        type="conditional"
        value={[{ type: "points", value: 20 }]}
        isVIP
      />,
      <AccessTag
        key="encrypted"
        type="conditional"
        value={[{ type: "encrypted" }]}
      />,
      <AccessTag
        key="book"
        type="conditional"
        value={[{ type: "book_only" }]}
      />,
    ],
  },
  {
    title: "多个条件",
    description:
      "两个及以上条件收纳为摘要；悬停或键盘聚焦即可查看 Tooltip 内的子权限标签。",
    tags: [
      <AccessTag
        key="summary"
        type="conditional"
        value={[{ type: "money", value: 10 }, { type: "encrypted" }]}
      />,
      <AccessTag
        key="vip-summary"
        type="conditional"
        value={[
          { type: "points", value: 20 },
          { type: "book_only" },
          { type: "encrypted" },
        ]}
        isVIP
      />,
    ],
  },
  {
    title: "详情图标模式",
    description:
      "iconOnly 仅用于详情标题等空间有限的位置，完整文案通过 Tooltip 提供。",
    tags: [
      <AccessTag key="icon-public" type="public" iconOnly />,
      <AccessTag key="icon-private" type="private" iconOnly isVIP />,
      <AccessTag
        key="icon-money"
        type="conditional"
        value={[{ type: "money", value: 100 }]}
        iconOnly
      />,
      <AccessTag
        key="icon-summary"
        type="conditional"
        value={[{ type: "money", value: 10 }, { type: "encrypted" }]}
        iconOnly
      />,
      <AccessTag
        key="icon-vip-summary"
        type="conditional"
        value={[
          { type: "money", value: 10 },
          { type: "encrypted" },
          { type: "book_only" },
        ]}
        iconOnly
        isVIP
      />,
    ],
  },
];

export default function AccessTagTestPage() {
  const navigate = useNavigate();

  return (
    <main className="access-tag-test">
      <header className="access-tag-test__header">
        <div>
          <p className="access-tag-test__eyebrow">
            /test/frontend/components/access-tag
          </p>
          <h1>Access Tag Lab</h1>
          <p>
            验证统一的可见性和条件权限标签，以及多条件和详情图标模式的 Tooltip
            行为。
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/home")}>
          返回首页
        </Button>
      </header>
      <div className="access-tag-test__grid">
        {cases.map((testCase) => (
          <section key={testCase.title} className="access-tag-test__panel">
            <h2>{testCase.title}</h2>
            <p>{testCase.description}</p>
            <div className="access-tag-test__row">{testCase.tags}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
