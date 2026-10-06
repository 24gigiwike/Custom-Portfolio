import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectCard } from "../components/ProjectCard";
import type { Project } from "../types/portfolio";

const withTech: Project = {
  id: "01",
  title: "CM26",
  category: "Luxury Fashion Website",
  url: "https://cm26.vercel.app/",
  tech: ["HTML", "CSS", "JavaScript"],
};

const withoutTech: Project = {
  id: "02",
  title: "Quiet study",
  category: "Essay",
  url: "https://ada.example/quiet",
  tech: [],
};

const emptyMeta: Project = {
  id: "03",
  title: "   ",
  category: "",
  url: "https://ada.example/empty",
  tech: ["", "  "],
};

const shown = renderToStaticMarkup(createElement(ProjectCard, { project: withTech }));
assert.match(shown, /class="project-meta"/);
assert.match(shown, /class="project-tech"/);
assert.match(shown, /HTML, CSS, JavaScript/);
assert.match(shown, />CM26</);
assert.match(shown, /Luxury Fashion Website/);
assert.equal(shown.includes("|"), false);
assert.deepEqual(withTech.tech, ["HTML", "CSS", "JavaScript"]);

const hiddenTech = renderToStaticMarkup(createElement(ProjectCard, { project: withoutTech }));
assert.equal(hiddenTech.includes("project-tech"), false);
assert.equal(hiddenTech.includes(",,"), false);
assert.match(hiddenTech, /Quiet study/);
assert.match(hiddenTech, /class="project-meta"/);

const noMeta = renderToStaticMarkup(createElement(ProjectCard, { project: emptyMeta }));
assert.equal(noMeta.includes("project-meta"), false);
assert.equal(noMeta.includes("project-tech"), false);

const css = readFileSync(new URL("../styles/portfolio.css", import.meta.url), "utf8");
const metaRule = css.match(/\.project-meta\s*\{[^}]+\}/)?.[0] ?? "";
const footerRule = css.match(/\.window-footer\s*\{[^}]+\}/)?.[0] ?? "";
const techRule = css.match(/\.project-meta \.project-tech\s*\{[^}]+\}/)?.[0] ?? "";
const narrowFooter = css.match(/@media \(max-width: 992px\)[\s\S]*?\.window-footer\s*\{[^}]+\}/)?.[0] ?? "";
assert.match(metaRule, /display:\s*flex/);
assert.doesNotMatch(metaRule, /display:\s*none/);
assert.match(footerRule, /display:\s*flex/);
assert.doesNotMatch(footerRule, /display:\s*none/);
assert.match(techRule, /overflow-wrap:\s*break-word/);
assert.match(techRule, /white-space:\s*normal/);
assert.match(narrowFooter, /flex-direction:\s*column/);

console.log("project technology presentation checks passed");
