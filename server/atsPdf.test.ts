import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AtsResume } from "../src/components/AtsResume";
import { atsSafePDFStyle, exportBlocks } from "../src/lib/atsDocument";
import type { AtsDocument } from "../src/lib/atsDocument";
import { validateExportText } from "../src/lib/exportValidation";

async function unusedPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as net.AddressInfo;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

test("real server Puppeteer PDF path preserves canonical contacts, headings, dates, fonts and ligature-free text", { timeout: 120000 }, async () => {
  const port = await unusedPort();
  const chrome = process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === "win32" &&
    existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined);
  const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
    cwd: process.cwd(), windowsHide: true,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), ...(chrome ? { PUPPETEER_EXECUTABLE_PATH: chrome } : {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", data => { logs += data.toString(); });
  child.stderr.on("data", data => { logs += data.toString(); });
  const base = `http://127.0.0.1:${port}`;
  const resume: AtsDocument = {
    personal_info: { name: "Avery & Candidate", email: "avery@example.org", phone: "+44 20 7946 0958", location: "London",
      linkedin: "https://www.linkedin.com/in/avery-candidate" },
    summary: "Configured efficient workflows, defined firewalls and certified office infrastructure.",
    skills: ["Azure", "Bicep", "TypeScript"],
    experience: [
      { role: "Platform Engineer", company: "Example Services Ltd", duration: "05/2021 - Present",
        bullets: Array.from({ length: 90 }, (_, index) => `Configured efficient workflow ${index + 1} and defined reliable firewall infrastructure for office services.`) },
      { role: "Consultant", company: "Prior Employer", duration: "2018 - 2020", bullets: ["Delivered cloud migration."] },
    ],
    projects: [{ title: "Office Platform", description: "Reliable infrastructure and workflow automation." }],
    certifications: ["Azure Fundamentals"],
    education: [{ degree: "BSc", institution: "Example University", duration: "2014 - 2018" }],
  };
  try {
    let ready = false;
    for (let attempt = 0; attempt < 600; attempt++) {
      if (child.exitCode !== null) throw new Error(`PDF test server exited: ${logs}`);
      try {
        const response = await fetch(`${base}/api/health-check`, { signal: AbortSignal.timeout(500) });
        if (response.ok) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Isolated PDF server did not become ready: ${logs}`);
    const blocks = exportBlocks(resume);
    const html = `<div id="resume-container">${renderToStaticMarkup(createElement(AtsResume, { blocks, masked: false }))}</div>`;
    const sessionResponse = await fetch(`${base}/api/pdf-session`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, css: atsSafePDFStyle(), fonts: "", title: `${resume.personal_info.name} - Resume`, scale: 0.5 }),
    });
    assert.equal(sessionResponse.status, 200);
    const { sessionId } = await sessionResponse.json();
    const response = await fetch(`${base}/api/download-pdf/${sessionId}`, { signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200, logs);
    assert.ok(response.headers.get("content-type")?.includes("application/pdf"));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
    try {
      const pages: string[] = [];
      const sizes: number[] = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => "str" in item ? item.str : "").join(" "));
        for (const item of content.items) {
          if ("str" in item && item.str.trim() && !/^[•·]$/.test(item.str)) sizes.push(Math.hypot(item.transform[0], item.transform[1]));
        }
      }
      assert.deepEqual(validateExportText(blocks.map(block => block.text).join("\n"), pages).errors, []);
      assert.ok(pdf.numPages > 2, "safe exports preserve readability rather than forcing a two-page fit");
      assert.ok(Math.min(...sizes) >= 10.9, `safe PDF font floor: ${Math.min(...sizes)}`);
      assert.ok(!/[\uFB00-\uFB06]/u.test(pages.join("\n")));
      assert.ok(pages.join("\n").includes("2018 - 2020"), "year-only dates survive extraction without invented months");
      const metadata = await pdf.getMetadata();
      assert.equal((metadata.info as { Title: string }).Title, "Avery & Candidate - Resume");
      assert.ok(Buffer.from(bytes).toString("latin1").includes("/FontFile2"), "local fonts are embedded");
      const annotations = await (await pdf.getPage(1)).getAnnotations();
      assert.ok(annotations.some(annotation => annotation.url === resume.personal_info.linkedin));
      if (process.env.ATS_EXPORT_ARTIFACT_DIR) {
        await mkdir(process.env.ATS_EXPORT_ARTIFACT_DIR, { recursive: true });
        await writeFile(path.join(process.env.ATS_EXPORT_ARTIFACT_DIR, "ats-real-server.pdf"), bytes);
        await writeFile(path.join(process.env.ATS_EXPORT_ARTIFACT_DIR, "ats-real-server-extracted.txt"), pages.join("\n\n"));
      }
    } finally {
      await pdf.destroy();
    }
    const masked = await fetch(`${base}/api/generate-pdf`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "<p>[REDACTED EMAIL]</p>", css: "", fonts: "" }),
    });
    assert.equal(masked.status, 400);
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
});
