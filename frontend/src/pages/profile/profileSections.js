export const profileSections = [
  "basic",
  "security",
  "moneyHistory",
  "pointsHistory",
  "userGroup",
  "articles",
  "books",
  "attachments",
];

export const enabledProfileSections = new Set(profileSections);

export function getProfileSection(section) {
  return enabledProfileSections.has(section) ? section : "basic";
}
