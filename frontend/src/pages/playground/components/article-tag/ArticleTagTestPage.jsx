import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArticleTag from "../../../../components/article-tag/ArticleTag";
import Button from "../../../../components/ui/Button";
import "./ArticleTagTestPage.css";

const tags = [
  { id: 1, name: "React" },
  { id: 2, name: "Design system" },
  { id: 3, name: "Accessibility" },
  { id: 4, name: "Name fallback" },
];

export default function ArticleTagTestPage() {
  const navigate = useNavigate();
  const [lastClick, setLastClick] = useState("");

  return (
    <main className="article-tag-test">
      <header className="article-tag-test__header">
        <div>
          <p className="article-tag-test__eyebrow">
            /test/frontend/components/article-tag
          </p>
          <h1>Article Tag Lab</h1>
          <p>
            Verifies stable generated palettes and the static, button, link, and
            disabled interaction contracts.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/home")}>
          Back to home
        </Button>
      </header>

      <section className="article-tag-test__panel">
        <h2>Static tags</h2>
        <div className="article-tag-test__row">
          {tags.map((tag) => (
            <ArticleTag key={tag.id} tag={tag} />
          ))}
        </div>
      </section>

      <section className="article-tag-test__panel">
        <h2>Button interaction</h2>
        <div className="article-tag-test__row">
          {tags.slice(0, 3).map((tag) => (
            <ArticleTag
              key={tag.id}
              tag={tag}
              onClick={(_, selectedTag) => setLastClick(selectedTag.name)}
            />
          ))}
          <ArticleTag
            tag={tags[0]}
            onClick={() => setLastClick("disabled")}
            disabled
          />
        </div>
        <output className="article-tag-test__result">
          {lastClick
            ? `Last clicked: ${lastClick}`
            : "Select a tag to verify its callback."}
        </output>
      </section>

      <section className="article-tag-test__panel">
        <h2>Navigation interaction</h2>
        <p>
          Navigation stays in the page layer and uses the component's onClick
          contract.
        </p>
        <div className="article-tag-test__row">
          <ArticleTag
            tag={tags[0]}
            onClick={(_, tag) =>
              navigate(`/tags?query=${encodeURIComponent(tag.name)}`)
            }
          />
          <ArticleTag
            tag={tags[1]}
            onClick={(_, tag) =>
              navigate(`/tags?query=${encodeURIComponent(tag.name)}`)
            }
          />
        </div>
      </section>
    </main>
  );
}
