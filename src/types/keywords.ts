export interface KeywordTrigger {
  id: string;
  keyword: string;
  color: string;
  description: string;
}

export const DEFAULT_KEYWORD_TRIGGERS: KeywordTrigger[] = [
  {
    id: "salary",
    keyword: "salary",
    color: "rgba(239, 68, 68, 0.8)", // Red
    description: "Salary and Compensation",
  },
  {
    id: "architecture",
    keyword: "architecture",
    color: "rgba(59, 130, 246, 0.8)", // Blue
    description: "System Architecture",
  },
  {
    id: "culture",
    keyword: "culture",
    color: "rgba(16, 185, 129, 0.8)", // Green
    description: "Company Culture & Fit",
  },
];
