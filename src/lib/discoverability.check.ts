import assert from "node:assert/strict";
import { emptyDiscoverability, normalizeDiscoverability } from "./discoverability";

assert.deepEqual(normalizeDiscoverability(undefined), emptyDiscoverability());
assert.deepEqual(normalizeDiscoverability({ identity: "studio", serviceRegion: "  ", faqs: [] }), emptyDiscoverability());

const normalized = normalizeDiscoverability({
  identity: "organization",
  serviceRegion: "  Lagos   Island  ",
  faqs: [
    { question: " What is the rate? ", answer: " It depends on the film. " },
    { question: "Only a question", answer: "" },
    { question: "", answer: "Only an answer" },
    { ownerId: "secret", question: "Safe?", answer: "Yes." },
  ],
});
assert.equal(normalized.identity, "organization");
assert.equal(normalized.serviceRegion, "Lagos Island");
assert.deepEqual(normalized.faqs, [
  { question: "What is the rate?", answer: "It depends on the film." },
  { question: "Safe?", answer: "Yes." },
]);
assert.equal(JSON.stringify(normalized).includes("secret"), false);
assert.equal(normalizeDiscoverability({
  faqs: Array.from({ length: 10 }, (_, index) => ({ question: `Q${index}`, answer: `A${index}` })),
}).faqs.length, 8);

console.log("discoverability checks passed");
