export const APP_REPOSITORY_URL = "https://github.com/wacmkxiaoyi/wacmk-blog";

export const primaryNavigation = [
  { key: "home", to: "/home", icon: "home", available: true },
  { key: "articles", to: "/articles", icon: "article", available: true },
  { key: "books", to: "/books", icon: "book", available: true },
  { key: "tags", to: "/tags", icon: "tag", available: true },
];

export const routeHeaderOptions = {
  home: { search: null },
  management: { search: null },
  articles: {
    search: { scope: "articles", endpoint: "/articles", queryKey: "query" },
  },
  books: {
    search: { scope: "books", endpoint: "/books", queryKey: "query" },
  },
  tags: {
    search: { scope: "tags", endpoint: "/tags", queryKey: "query" },
  },
  accessGate: { search: null },
};

export function getRouteHeaderOptions(pathname) {
  if (pathname.startsWith("/manage/")) return routeHeaderOptions.management;
  if (pathname.startsWith("/articles")) return routeHeaderOptions.articles;
  if (pathname.startsWith("/books")) return routeHeaderOptions.books;
  if (pathname.startsWith("/tags")) return routeHeaderOptions.tags;
  if (pathname.startsWith("/access/")) return routeHeaderOptions.accessGate;
  return routeHeaderOptions.home;
}
