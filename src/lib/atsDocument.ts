import { parseDurationRange } from "./bulletBudget";
import { formatCertification } from "./certifications";
import type { Certification, ResumeData } from "../types";
import type { OptimizationResult } from "../services/geminiService";

export const ATS_FONTS = ["Calibri", "Arial", "Cambria", "Georgia", "Times New Roman", "Verdana"] as const;
export const ATS_BODY_PT = 11;
export type AtsFont = typeof ATS_FONTS[number];

export interface AtsDocument {
  personal_info: OptimizationResult["personal_info"];
  summary: string;
  skills: string[] | Record<string, string[]>;
  experience: OptimizationResult["experience"];
  projects: (string | { title: string; description?: string })[];
  certifications: (string | Certification)[];
  education: unknown[];
}

export interface ExportBlock {
  kind: "name" | "contact" | "heading" | "text" | "bullet";
  section: "header" | "summary" | "skills" | "experience" | "projects" | "certifications" | "education";
  unit: string;
  text: string;
  link?: string;
  linkText?: string;
  employment?: { title: string; company: string; dates: string };
  skill?: { category: string; items: string };
}

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export function linkedinUrl(value: string): string {
  const url = text(value);
  return /^(?:www\.)?linkedin\.com\//i.test(url) ? `https://${url}` : url;
}

/** Select content once; preserve shared arrays rather than cloning generation diagnostics. */
export function canonicalResume(
  resume: OptimizationResult | ResumeData,
  overrides: Partial<AtsDocument["personal_info"]> = {},
): AtsDocument {
  const info = { ...resume.personal_info, ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => text(value))) };
  return {
    personal_info: {
      name: text(info.name), location: text(info.location), email: text(info.email), phone: text(info.phone),
      linkedin: linkedinUrl(info.linkedin || ""),
    },
    summary: text("summary" in resume ? resume.summary : resume.personal_info?.summary),
    skills: resume.skills || [],
    experience: resume.experience || [],
    projects: resume.projects || [],
    certifications: resume.certifications || [],
    education: resume.education || [],
  };
}

function durationEndpoints(duration: string): string[] {
  const normalized = duration.replace(/\b(?:till|to|until|up to)\s+(?:date|now|today)\b/gi, " - Present");
  let parts = normalized.split(/\s+[-–—]+\s+|\s*[–—]+\s*|\s+(?:to|until|through|thru)\s+/i);
  if (parts.length < 2) parts = normalized.split(/\s*-\s*/);
  return parts.map(part => part.trim());
}

const yearOnly = (value: string) => /\b(?:19|20)\d{2}\b/.test(value) &&
  !/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\d{1,2}[./-]\d{4}|\d{4}[./-]\d{1,2}/i.test(value);

export function hasYearOnlyDates(duration: string): boolean {
  return durationEndpoints(duration).some(yearOnly);
}

/** The parser's Jan/Dec bounds for bare years are for comparisons, not display. */
export function formatDurationForAts(duration: string): string {
  const original = text(duration);
  const range = parseDurationRange(original);
  if (!range) return original;
  const parts = durationEndpoints(original);
  const format = (date: Date, source: string) => yearOnly(source)
    ? String(date.getFullYear())
    : date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${format(range.start, parts[0])} - ${range.ongoing ? "Present" : format(range.end, parts[parts.length - 1])}`;
}

export function educationText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const entry = value as Record<string, unknown>;
  return [entry.degree, entry.institution || entry.school, entry.field_of_study || entry.major,
    entry.duration || entry.expected_completion || entry.graduation_date].map(text).filter(Boolean).join(" | ");
}

/** Ordered body content shared by the preview, PDF, Word and compatibility checks. */
export function exportBlocks(resume: AtsDocument): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  const add = (kind: ExportBlock["kind"], section: ExportBlock["section"], value: unknown, link?: string, unit: string = section) => {
    if (text(value)) blocks.push({ kind, section, unit, text: text(value), ...(link ? { link } : {}) });
  };
  const section = (id: ExportBlock["section"], heading: string, values: string[], kind: "text" | "bullet" = "text") => {
    if (!values.some(value => text(value))) return;
    add("heading", id, heading);
    values.forEach(value => add(kind, id, value));
  };
  const info = resume.personal_info;
  add("name", "header", info.name);
  const linkedin = linkedinUrl(info.linkedin);
  const linkText = linkedin.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/$/, "");
  add("contact", "header", [info.location, info.email, info.phone, linkText].map(text).filter(Boolean).join(" | "),
    /^https?:\/\/(?:www\.)?linkedin\.com\//i.test(linkedin) ? linkedin : undefined);
  const contact = blocks.find(block => block.kind === "contact");
  if (contact?.link) contact.linkText = linkText;
  section("summary", "Professional Summary", [resume.summary]);
  section("skills", "Skills", Array.isArray(resume.skills) ? [resume.skills.map(text).filter(Boolean).join(", ")] :
    Object.entries(resume.skills).filter(([name]) => !name.startsWith("_"))
      .map(([name, items]) => Array.isArray(items) && items.some(item => text(item)) ? `${name}: ${items.map(text).filter(Boolean).join(", ")}` : ""));
  if (!Array.isArray(resume.skills)) {
    for (const block of blocks.filter(block => block.section === "skills" && block.kind === "text")) {
      const category = Object.keys(resume.skills).find(name => block.text.startsWith(`${name}: `));
      if (category) block.skill = { category, items: block.text.slice(category.length + 2) };
    }
  }
  if (resume.experience.length) {
    add("heading", "experience", "Work Experience");
    resume.experience.forEach((role, index) => {
      const unit = `experience:${index}`;
      const employment = { title: text(role.role), company: text(role.company), dates: formatDurationForAts(role.duration) };
      const line = [employment.title, employment.company, employment.dates].filter(Boolean).join(" | ");
      if (line) blocks.push({ kind: "text", section: "experience", unit, text: line, employment });
      (role.bullets || []).forEach(bullet => add("bullet", "experience", bullet, undefined, unit));
    });
  }
  if (resume.projects.some(project => typeof project === "string" ? text(project) : text(project.title) || text(project.description))) {
    add("heading", "projects", "Projects");
    resume.projects.forEach((project, index) => {
      const values = typeof project === "string" ? [project] : [project.title, project.description];
      values.forEach(value => add("text", "projects", value, undefined, `projects:${index}`));
    });
  }
  section("certifications", "Certifications", resume.certifications.map(formatCertification), "bullet");
  section("education", "Education", resume.education.map(educationText));
  return blocks;
}

/** A heading travels with its first entry, while subsequent entries remain independent. */
export function groupExportUnits(blocks: ExportBlock[]): { section: ExportBlock["section"]; unit: string; blocks: ExportBlock[] }[] {
  const groups: ReturnType<typeof groupExportUnits> = [];
  let headings: ExportBlock[] = [];
  for (const block of blocks) {
    if (block.kind === "heading") {
      headings.push(block);
      continue;
    }
    const previous = groups[groups.length - 1];
    if (previous?.unit === block.unit && previous.section === block.section && !headings.length) {
      previous.blocks.push(block);
    } else {
      groups.push({ section: block.section, unit: block.unit, blocks: [...headings, block] });
      headings = [];
    }
  }
  if (headings.length) {
    const first = headings[0];
    groups.push({ section: first.section, unit: first.unit, blocks: headings });
  }
  return groups;
}

export function sanitizedMetadata(value: string): string {
  return value.replace(/[\x00-\x1f\x7f]/g, "").trim();
}

export function resumeFileName(resume: AtsDocument, role: string, extension: string, company?: string): string {
  const safe = (value: string) => value.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim();
  return `${[safe(resume.personal_info.name) || "Candidate", safe(role) || "Resume", company ? safe(company) : ""].filter(Boolean).join("-")}.${extension}`;
}

export function assertUnmaskedExport(masked: boolean, blocks: ExportBlock[]): void {
  if (masked || blocks.some(block => /\[(?:REDACTED|MASKED)\b[^\]]*\]/i.test(block.text))) {
    throw new Error("Turn off PII masking before exporting a resume.");
  }
}

export function atsSafePDFStyle(): string {
  return `
    @page { size: A4; margin: 16mm !important; }
    #resume-container, .resume-page { padding: 0 !important; min-width: 0 !important; min-height: 0 !important; transform: none !important; }
    .ats-safe-resume { line-height: 1.25 !important; letter-spacing: normal !important; color: #000 !important; }
    .ats-safe-resume p, .ats-safe-resume li { font-size: 11pt !important; line-height: 1.25 !important; }
    .ats-safe-resume .resume-contact { font-size: 10.25pt !important; text-align: center !important; }
    .ats-safe-resume h1 { font-size: 18pt !important; }
    .ats-safe-resume h2 { font-size: 12pt !important; break-after: avoid; }
  `;
}
