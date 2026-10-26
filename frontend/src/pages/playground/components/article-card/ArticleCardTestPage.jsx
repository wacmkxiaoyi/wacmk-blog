import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArticleCard from "../../../../components/article-card/ArticleCard";
import Button from "../../../../components/ui/Button";
import sampleCoverUrl from "../../../../assets/book-card-sample-cover.svg";
import "./ArticleCardTestPage.css";

const initialArticles = [
  {
    id: "card-architecture",
    title: "将通用 Card 包组织为可演进的文章浏览体验",
    abstract:
      "文章卡片组合通用插槽与业务领域组件，让文章列表在不牺牲交互能力的情况下保持稳定的视觉节奏。",
    author: { displayName: "Design Systems" },
    publishedAt: "2026-08-23T08:00:00Z",
    tags: [
      { id: "react", name: "React" },
      { id: "design", name: "Design" },
    ],
    visibility: "public",
    interaction: {
      isStarred: false,
      upCount: 24,
      downCount: 1,
      currentVote: null,
    },
    viewCount: 426,
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #e8d9ff 0%, #f8e2ed 50%, #dcebff 100%)",
    },
  },
  {
    id: "cover-story",
    title: "用本地媒体封面强化内容层级，而不绑定外部资源",
    content:
      "当列表响应未提供摘要时，卡片会从 content 中提取纯文本作为展示兜底。HTML 和常见 Markdown 标记不会泄漏到页面中。",
    author: { username: "wacmk" },
    updatedAt: "2026-08-22T08:00:00Z",
    coverUrl: sampleCoverUrl,
    tags: [{ id: "media", name: "Media" }],
    visibility: "conditional",
    condition_rules: [{ type: "points", value: 10 }],
    access_scope: "standalone",
    vip_access_permission: "conditional",
    vip_condition_rules: [{ type: "money", value: 5 }, { type: "encrypted" }],
    interaction: {
      isStarred: true,
      upCount: 8,
      downCount: 0,
      currentVote: "up",
    },
    viewCount: 95,
  },
  {
    id: "empty-tags",
    title: "无标签状态保留统一的底部信息布局",
    excerpt:
      "当文章没有标签时，卡片会显示空标签提示，同时保持权限和互动信息的固定区域高度。",
    author: { displayName: "Content Team" },
    publishedAt: "2026-08-21T08:00:00Z",
    tags: [],
    visibility: "private",
    interaction: {
      isStarred: false,
      upCount: 3,
      downCount: 2,
      currentVote: "down",
    },
    background: { type: "color", value: "#f1ecff" },
  },
  {
    id: "hidden-tags",
    title: "隐藏标签区的紧凑列表变体",
    abstract:
      "通过 showTags 关闭整个标签区域，而不是仅隐藏标签内容。权限与互动行仍保持稳定布局。",
    author: { displayName: "Editorial" },
    publishedAt: "2026-08-20T08:00:00Z",
    tags: [{ id: "hidden", name: "Hidden" }],
    visibility: "public",
    interaction: {
      isStarred: false,
      upCount: 6,
      downCount: 0,
      currentVote: null,
    },
    viewCount: 128,
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #e4f2ff 0%, #e8f7f0 48%, #f6ebff 100%)",
    },
  },
];

function updateVote(interaction, nextVote) {
  const previousVote = interaction.currentVote;
  if (previousVote === nextVote) return interaction;
  return {
    ...interaction,
    currentVote: nextVote,
    upCount:
      interaction.upCount +
      (nextVote === "up" ? 1 : previousVote === "up" ? -1 : 0),
    downCount:
      interaction.downCount +
      (nextVote === "down" ? 1 : previousVote === "down" ? -1 : 0),
  };
}

function ArticlePickerCard({ article, selected, onSelect }) {
  return (
    <div
      className={[
        "article-card-test__picker-card",
        selected && "article-card-test__picker-card--selected",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="article-card-test__picker-status" aria-hidden="true">
        {selected ? "已选择" : "选择文章"}
      </span>
      <ArticleCard
        article={article}
        showTags={false}
        onClick={() => onSelect(article)}
      />
    </div>
  );
}

export default function ArticleCardTestPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState(initialArticles);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [lastAction, setLastAction] = useState("等待文章交互");
  const updateArticle = (articleId, updater) =>
    setArticles((items) =>
      items.map((item) => (item.id === articleId ? updater(item) : item)),
    );

  return (
    <main className="article-card-test">
      <header className="article-card-test__header">
        <div>
          <p className="article-card-test__eyebrow">
            /test/frontend/components/article-card
          </p>
          <h1>Article Card Lab</h1>
          <p>
            验证文章摘要、封面、权限、标签以及由父层统一管理的收藏和投票状态。
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/home")}>
          返回首页
        </Button>
      </header>
      <section className="article-card-test__notice" aria-live="polite">
        <strong>最近操作</strong>
        <span>{lastAction}</span>
      </section>
      <section
        className="article-card-test__grid"
        aria-label="Article card examples"
      >
        {articles.map((article, index) => (
          <ArticleCard
            key={article.id}
            article={article}
            showTags={article.id !== "hidden-tags"}
            onClick={(currentArticle) => {
              setLastAction(`打开操作由页面接管：${currentArticle.title}`);
            }}
            onTagClick={(tag, currentArticle) =>
              setLastAction(`标签操作：#${tag.name}（${currentArticle.title}）`)
            }
            onStarChange={(currentArticle, nextStarred) => {
              updateArticle(currentArticle.id, (item) => ({
                ...item,
                interaction: { ...item.interaction, isStarred: nextStarred },
              }));
              setLastAction(
                `${nextStarred ? "收藏" : "取消收藏"}：${currentArticle.title}`,
              );
            }}
            onVoteChange={(currentArticle, nextVote) => {
              updateArticle(currentArticle.id, (item) => ({
                ...item,
                interaction: updateVote(item.interaction, nextVote),
              }));
              setLastAction(
                `${nextVote === "up" ? "点赞" : nextVote === "down" ? "点踩" : "取消投票"}：${currentArticle.title}`,
              );
            }}
          />
        ))}
      </section>
      <section
        className="article-card-test__picker-section"
        aria-labelledby="article-picker-card-title"
      >
        <div className="article-card-test__picker-heading">
          <div>
            <p>Independent playground scenario</p>
            <h2 id="article-picker-card-title">ArticlePickerCard</h2>
            <span>
              选择状态由文章选择器管理，不属于通用 `ArticleCard` API。
            </span>
          </div>
          <strong aria-live="polite">
            {selectedArticleId
              ? `已选择：${articles.find((article) => article.id === selectedArticleId)?.title}`
              : "尚未选择文章"}
          </strong>
        </div>
        <div className="article-card-test__picker-grid">
          {articles.slice(0, 3).map((article) => (
            <ArticlePickerCard
              key={article.id}
              article={article}
              selected={selectedArticleId === article.id}
              onSelect={(currentArticle) => {
                setSelectedArticleId((current) =>
                  current === currentArticle.id ? null : currentArticle.id,
                );
                setLastAction(`切换选择状态：${currentArticle.title}`);
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
