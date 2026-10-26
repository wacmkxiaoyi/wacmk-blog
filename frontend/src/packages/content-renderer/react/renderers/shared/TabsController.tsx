import React, { useEffect, useState } from "react";

export function TabsController({ items, renderLabel, renderPanel }) {
  const [activeKey, setActiveKey] = useState(items[0]?.key || "");

  useEffect(() => {
    setActiveKey((current) =>
      items.some((item) => item.key === current)
        ? current
        : items[0]?.key || "",
    );
  }, [items]);

  return (
    <div className="cr-tabs">
      <div className="cr-tabs-nav" role="tablist">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`cr-tab-button${item.key === activeKey ? " is-active" : ""}`}
            onClick={() => setActiveKey(item.key)}
            aria-selected={item.key === activeKey}
          >
            {renderLabel(item)}
          </button>
        ))}
      </div>
      <div className="cr-tabs-panels">
        {items.map((item, index) => (
          <section
            key={item.key}
            hidden={item.key !== activeKey}
            className={`cr-tab-panel${item.key === activeKey ? " is-active" : ""}`}
          >
            {renderPanel(item, index)}
          </section>
        ))}
      </div>
    </div>
  );
}
