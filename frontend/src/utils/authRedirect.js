const guestOnlyPaths = new Set(["/", "/register", "/forgot-password"]);

function getPathname(target) {
  const [withoutHash] = String(target).split("#");
  const [pathname] = withoutHash.split("?");
  return pathname || "/";
}

function sanitizeRedirectTarget(target, fallback = "/home") {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  if (!target.startsWith("/") || target.startsWith("//")) {
    return fallback;
  }

  if (guestOnlyPaths.has(getPathname(target))) {
    return fallback;
  }

  return target;
}

export function getCurrentLocationPath(locationLike = window.location) {
  const pathname = locationLike?.pathname || "/";
  const search = locationLike?.search || "";
  const hash = locationLike?.hash || "";
  return `${pathname}${search}${hash}`;
}

export function buildLoginRedirectPath(locationLike) {
  const target = sanitizeRedirectTarget(
    getCurrentLocationPath(locationLike),
    "",
  );

  if (!target) {
    return "/";
  }

  return `/?redirect=${encodeURIComponent(target)}`;
}

export function getPostAuthRedirectPath(search, fallback = "/home") {
  const params = new URLSearchParams(search || "");
  return sanitizeRedirectTarget(params.get("redirect"), fallback);
}
