import type { CSSProperties } from "react";
import type { ExportBlock } from "../lib/atsDocument";

export function AtsResume({ blocks, masked, sectionStyle, onSection }: {
  blocks: ExportBlock[]; masked: boolean;
  sectionStyle?: (section: string) => CSSProperties;
  onSection?: (section: string) => void;
}) {
  return <div className={`resume-page bg-white text-black ${sectionStyle ? "" : "ats-safe-resume"}`}
    style={{ width: "210mm", minHeight: "297mm", padding: "16mm", fontFamily: "Calibri, Arial, sans-serif", fontSize: "11pt", lineHeight: 1.25, letterSpacing: "normal" }}>
    {blocks.map((block, index) => {
      const style: CSSProperties = { margin: "0 0 6pt", overflowWrap: "anywhere", ...sectionStyle?.(block.section),
        ...(block.kind === "heading" ? { fontSize: "12pt", fontWeight: "bold", marginTop: "12pt", breakAfter: "avoid" } : {}),
        ...(block.kind === "name" ? { fontSize: "18pt", fontWeight: "bold", breakAfter: "avoid" } : {}) };
      const content = masked && block.section === "header" ? (block.kind === "name" ? "[REDACTED NAME]" : "[REDACTED CONTACT]") :
        block.kind === "contact" && block.link ? <>{block.text.slice(0, block.text.indexOf(block.link))}<a href={block.link} style={{ color: "inherit" }}>{block.link}</a>{block.text.slice(block.text.indexOf(block.link) + block.link.length)}</> : block.text;
      const props = { style, onClick: () => onSection?.(block.section) };
      if (block.kind === "name") return <h1 key={index} {...props}>{content}</h1>;
      if (block.kind === "heading") return <h2 key={index} {...props}>{content}</h2>;
      if (block.kind === "bullet") return <ul key={index} style={{ paddingLeft: "18pt", margin: 0, listStyleType: "disc" }}><li {...props}>{content}</li></ul>;
      return <p key={index} {...props}>{content}</p>;
    })}
  </div>;
}
