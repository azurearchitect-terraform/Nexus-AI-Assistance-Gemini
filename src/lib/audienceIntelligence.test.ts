import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audienceBrief, buildAudiencePrompt, extractJdSignals,
  fuseAudienceDecision, jdFingerprint, scoreAudiencesByRules,
} from "./audienceIntelligence";

const ic = "Senior Cloud Architect. This is a hands-on individual contributor position. Design Azure infrastructure and implement Kubernetes platforms. Require 8 years of experience. Partner with engineering teams on systems design.";
const manager = "Cloud Engineering Manager. Manage a team of 12 engineers. Own hiring and performance reviews. Build Azure infrastructure and platform engineering capabilities.";

test("an IC architect posting cannot select director, platform director or executive personas", () => {
  const rules = scoreAudiencesByRules(extractJdSignals(ic, "Director"));
  assert.ok(rules.some((pick) => pick.id === "cloud-architect"));
  assert.ok(!rules.some((pick) => /director|cto-vp|platform-dir|leadership|mgr/.test(pick.id)));
  const decision = fuseAudienceDecision({
    audiences: [{ id: "cto-vp", confidence: 1, evidence: [ic] }, { id: "director-large", confidence: 1, evidence: [ic] }],
  }, rules, ic, "Director");
  assert.ok(!decision.audiences.some((pick) => /director|cto-vp/.test(pick.id)));
});

test("reporting to executives and having no direct reports does not imply management", () => {
  const jd = `${ic} Report to the Director of Engineering. Partner with the CTO. No direct reports or people management.`;
  const rules = scoreAudiencesByRules(extractJdSignals(jd));
  assert.ok(!rules.some((pick) => /director|cto-vp|platform-dir|leadership|mgr/.test(pick.id)));
});

test("a leadership suggestion must quote the actual management evidence", () => {
  const decision = fuseAudienceDecision({
    audiences: [{ id: "leadership", confidence: 1, evidence: ["Build Azure infrastructure and platform engineering capabilities."] }],
  }, scoreAudiencesByRules(extractJdSignals(manager)), manager);
  assert.equal(decision.source, "rules");
  assert.match(decision.warnings.join(" "), /Rejected leadership/);
});

test("a stated team of 12 enables people-leadership selection", () => {
  const signals = extractJdSignals(manager, "Cloud Engineering Manager");
  assert.equal(signals.teamSize, 12);
  assert.equal(signals.peopleManagement.value, "people management");
  const rules = scoreAudiencesByRules(signals);
  assert.ok(rules.some((pick) => pick.id === "leadership"));
  assert.ok(!rules.some((pick) => pick.id === "cto-vp"));
  const decision = fuseAudienceDecision({
    audiences: [{ id: "leadership", confidence: 0.9, evidence: ["Manage a team of 12 engineers."] }],
  }, rules, manager);
  assert.equal(decision.primary, "leadership");
  assert.ok(decision.audiences[0].confidence >= 0.8);
});

test("unknown catalog IDs and fabricated JD evidence are rejected", () => {
  const decision = fuseAudienceDecision({
    audiences: [
      { id: "my-own-role", confidence: 1, evidence: [ic] },
      { id: "microsoft", confidence: 1, evidence: ["Manage 500 direct reports at Microsoft."] },
      { id: "custom", confidence: 1, evidence: [ic] },
    ],
    custom_persona: "CEO",
  }, scoreAudiencesByRules(extractJdSignals(ic)), ic);
  assert.equal(decision.source, "rules");
  assert.equal(decision.customPersona, undefined);
  assert.ok(decision.warnings.length >= 2);
});

test("fingerprint is stable under whitespace/case normalization, sensitive to role and JD", () => {
  assert.equal(jdFingerprint("  Azure\nArchitect ", " Cloud "), jdFingerprint("azure architect", "cloud"));
  assert.notEqual(jdFingerprint(ic, "Architect"), jdFingerprint(ic, "Manager"));
  assert.notEqual(jdFingerprint(ic, "Architect"), jdFingerprint(manager, "Architect"));
});

test("platform persona needs actual Microsoft/Azure evidence and decisions remain bounded", () => {
  const jd = "Principal Architect. Hands-on individual contributor designing AWS cloud systems.";
  const signals = extractJdSignals(jd);
  assert.deepEqual(signals.platforms, ["AWS"]);
  const rules = scoreAudiencesByRules(signals);
  assert.ok(!rules.some((pick) => pick.id === "microsoft"));
  const decision = fuseAudienceDecision(null, rules, jd);
  assert.ok(decision.audiences.length >= 1 && decision.audiences.length <= 3);
  assert.match(audienceBrief(decision, decision.primary), /SOURCE RESUME does not evidence/);
});

test("prompt contains the catalog, strict JSON and bounded posting excerpt", () => {
  const prompt = buildAudiencePrompt("A".repeat(20000) + "Manage a team of 12 engineers.", "Manager");
  assert.ok(prompt.length < 19000);
  assert.match(prompt, /posting middle omitted/);
  assert.match(prompt, /cloud-architect:/);
  assert.match(prompt, /custom is never an ID/);
});
