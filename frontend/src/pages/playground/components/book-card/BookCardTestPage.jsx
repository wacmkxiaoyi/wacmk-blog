import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BookCard from "../../../../components/book-card/BookCard";
import Button from "../../../../components/ui/Button";
import sampleCoverUrl from "../../../../assets/book-card-sample-cover.svg";
import "./BookCardTestPage.css";

const initialBooks = [
  {
    id: "design-system",
    name: "设计系统实践手册",
    abstract:
      "从令牌、组件边界到跨页面的一致交互，系统整理可持续演进的前端设计体系。",
    updatedAt: "2026-08-23T08:00:00Z",
    articleCount: 18,
    visibility: "public",
    interaction: {
      isStarred: false,
      upCount: 12,
      downCount: 1,
      currentVote: null,
    },
  },
  {
    id: "member-library",
    name: "会员内容资料库",
    abstract:
      "包含系列化的技术文章、项目复盘和配套阅读路线，演示普通与 VIP 独立通道的组合展示。",
    coverUrl: sampleCoverUrl,
    updatedAt: "2026-08-22T08:00:00Z",
    articleCount: 36,
    visibility: "conditional",
    condition_rules: [{ type: "points", value: 20 }, { type: "encrypted" }],
    access_scope: "standalone",
    vip_access_permission: "conditional",
    vip_condition_rules: [{ type: "money", value: 10 }],
    interaction: {
      isStarred: true,
      upCount: 7,
      downCount: 0,
      currentVote: "up",
    },
  },
  {
    id: "private-notes",
    name: "私有研究笔记",
    updatedAt: "2026-08-21T08:00:00Z",
    articleCount: 0,
    visibility: "private",
    interaction: {
      isStarred: false,
      upCount: 2,
      downCount: 1,
      currentVote: "down",
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

export default function BookCardTestPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState(initialBooks);
  const [lastAction, setLastAction] = useState("等待书籍交互");
  const updateBook = (bookId, updater) =>
    setBooks((items) =>
      items.map((item) => (item.id === bookId ? updater(item) : item)),
    );

  return (
    <main className="book-card-test">
      <header className="book-card-test__header">
        <div>
          <p className="book-card-test__eyebrow">
            /test/frontend/components/book-card
          </p>
          <h1>Book Card Lab</h1>
          <p>
            验证书籍封面、访问条件、文章数量、更新时间以及由页面统一管理的收藏交互。
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/home")}>
          返回首页
        </Button>
      </header>
      <section className="book-card-test__notice" aria-live="polite">
        <strong>最近操作</strong>
        <span>{lastAction}</span>
      </section>
      <section className="book-card-test__list" aria-label="Book card examples">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onClick={(currentBook) =>
              setLastAction(`打开操作由页面接管：${currentBook.name}`)
            }
            onStarChange={(currentBook, nextStarred) => {
              updateBook(currentBook.id, (item) => ({
                ...item,
                interaction: { ...item.interaction, isStarred: nextStarred },
              }));
              setLastAction(
                `${nextStarred ? "收藏" : "取消收藏"}：${currentBook.name}`,
              );
            }}
            onVoteChange={(currentBook, nextVote) => {
              updateBook(currentBook.id, (item) => ({
                ...item,
                interaction: updateVote(item.interaction, nextVote),
              }));
              setLastAction(
                `${nextVote === "up" ? "点赞" : nextVote === "down" ? "点踩" : "取消投票"}：${currentBook.name}`,
              );
            }}
          />
        ))}
      </section>
      <section
        className="book-card-test__compact-section"
        aria-labelledby="book-card-compact-title"
      >
        <div>
          <p>Independent consumer scenario</p>
          <h2 id="book-card-compact-title">名片页精简变体</h2>
          <span>
            关闭收藏按钮后，卡片仍保留访问级别、文章数、更新时间和简介。
          </span>
        </div>
        <BookCard book={books[0]} showStar={false} />
      </section>
    </main>
  );
}
