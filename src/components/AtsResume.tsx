import type { CSSProperties } from "react";
import type { ExportBlock } from "../lib/atsDocument";

export function AtsResume({ blocks, masked, sectionStyle, onSection, sectionOnly = false, activeSection }: {
  blocks: ExportBlock[]; masked: boolean;
  sectionStyle?: (section: string) => CSSProperties;
  onSection?: (section: string) => void;
  sectionOnly?: boolean;
  activeSection?: string | null;
}) {
  const standard = Boolean(sectionStyle);
  const sections = [...new Set(blocks.map(block => block.section))];
  const content = sections.map(section => <div key={section}
    className={`resume-section ${onSection ? "cursor-pointer transition-all rounded hover:bg-black/5" : ""} ${activeSection === section ? "bg-emerald-50/50 outline-dashed outline-1 outline-emerald-500/30" : ""}`}
    onClick={() => onSection?.(section)}
    style={{ marginBottom: "6pt", ...sectionStyle?.(section), ...(section === "header" ? { textAlign: "center" } : {}) }}>
    {blocks.filter(block => block.section === section).map((block, index) => {
      const style: CSSProperties = { margin: "0 0 4pt", overflowWrap: "break-word" };
      const content = masked && block.section === "header" ? (block.kind === "name" ? "[REDACTED NAME]" : "[REDACTED CONTACT]") :
        block.kind === "contact" && block.link && block.linkText ? <>
          {block.text.slice(0, block.text.indexOf(block.linkText))}
          <a href={block.link} style={{ color: "inherit", whiteSpace: "nowrap" }}>{block.linkText}</a>
          {block.text.slice(block.text.indexOf(block.linkText) + block.linkText.length)}
        </> : block.text;
      if (block.kind === "name") return <h1 key={index} style={{ ...style, fontSize: "18pt", fontWeight: "bold", breakAfter: "avoid" }}>{content}</h1>;
      if (block.kind === "heading") return <h2 key={index} style={{ ...style, fontSize: "12pt", fontWeight: "bold", breakAfter: "avoid",
        ...(standard ? { textTransform: "uppercase", borderBottom: "1px solid #000", paddingBottom: "2pt", letterSpacing: "0.05em" } : {}) }}>{content}</h2>;
      if (block.employment) {
        const { title, company, dates } = block.employment;
        return <div key={index} className="experience-heading" style={{ ...style, display: "flex", alignItems: "baseline", gap: "8pt", breakAfter: "avoid" }}>
          <span>{title && <strong>{title}</strong>}{title && company ? " | " : ""}{company && <strong>{company}</strong>}</span>
          {dates && <span style={{ marginLeft: "auto", whiteSpace: "nowrap", textAlign: "right" }}>{dates}</span>}
        </div>;
      }
      if (block.skill) return <p key={index} style={style}><strong>{block.skill.category}:</strong> {block.skill.items}</p>;
      if (block.kind === "bullet") return <ul key={index} style={{ paddingLeft: "18pt", margin: 0, listStyleType: "disc" }}><li style={{ ...style, breakInside: "avoid" }}>{content}</li></ul>;
      return <p key={index} className={block.kind === "contact" ? "resume-contact" : undefined}
        style={{ ...style, ...(block.kind === "contact" ? { fontSize: "10.25pt", textAlign: "center" } : {}) }}>{content}</p>;
    })}
  </div>);
  if (sectionOnly) return <>{content}</>;
  return <div className={`resume-page bg-white text-black ${standard ? "" : "ats-safe-resume"}`}
    style={{ width: "210mm", minHeight: "297mm", padding: "16mm", fontFamily: "Calibri, Arial, sans-serif", fontSize: "11pt", lineHeight: 1.25, letterSpacing: "normal" }}>
    {content}
  </div>;
}
