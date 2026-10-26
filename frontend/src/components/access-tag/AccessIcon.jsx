import React from "react";

const icons = {
  users: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M3 20c0-3 2.2-5 5-5s5 2 5 5M11 20c0-3 2.2-5 5-5s5 2 5 5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 21c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="6.5" ry="3" />
      <path d="M5.5 6v6c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3V6M5.5 12v6c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-6" />
    </>
  ),
  gem: (
    <>
      <path d="m12 3 7 6-7 12L5 9l7-6Z" />
      <path d="m5 9 4.5 4.2L12 21l2.5-7.8L19 9M8.5 3 12 9l3.5-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H12v17h4.5A3.5 3.5 0 0 1 20 22V5.5Z" />
    </>
  ),
};

export default function AccessIcon({ name }) {
  return (
    <svg
      className="access-tag__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || null}
    </svg>
  );
}
