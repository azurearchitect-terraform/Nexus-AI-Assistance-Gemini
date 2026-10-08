import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { assertUnmaskedExport, exportBlocks, sanitizedMetadata } from "./atsDocument";
import type { AtsDocument, ExportBlock } from "./atsDocument";

function runs(block: ExportBlock): (TextRun | ExternalHyperlink)[] {
  const style = { font: "Calibri", color: "000000", size: block.kind === "name" ? 36 : block.kind === "heading" ? 24 : 22,
    bold: block.kind === "name" || block.kind === "heading" };
  if (block.kind === "contact" && block.link) {
    const position = block.text.indexOf(block.link);
    return [
      new TextRun({ text: block.text.slice(0, position), ...style }),
      new ExternalHyperlink({ link: block.link, children: [new TextRun({ text: block.link, ...style })] }),
      new TextRun({ text: block.text.slice(position + block.link.length), ...style }),
    ];
  }
  return [new TextRun({ text: block.text, ...style })];
}

export async function createResumeDOCX(resume: AtsDocument, blocks = exportBlocks(resume), masked = false): Promise<Blob> {
  assertUnmaskedExport(masked, blocks);
  const name = sanitizedMetadata(resume.personal_info.name) || "Candidate";
  const document = new Document({
    creator: name,
    title: `${name} - Resume`,
    description: "Resume",
    styles: {
      default: { document: { run: { font: "Calibri", size: 22, color: "000000" }, paragraph: { spacing: { line: 300, after: 120 } } } },
      paragraphStyles: [{
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { font: "Calibri", size: 24, bold: true, color: "000000" },
        paragraph: { keepNext: true, outlineLevel: 0 },
      }],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 907, bottom: 907, left: 907, right: 907 } } },
      children: blocks.map(block => new Paragraph({
        children: runs(block),
        ...(block.kind === "heading" ? { heading: HeadingLevel.HEADING_1 } : {}),
        ...(block.kind === "bullet" ? { bullet: { level: 0 } } : {}),
        keepNext: block.kind === "heading" || block.kind === "name",
        spacing: { before: block.kind === "heading" ? 240 : 0, after: 120, line: 300 },
      })),
    }],
  });
  return Packer.toBlob(document);
}
