import assert from "node:assert/strict";
import { commaSeparated } from "./commaList";

const tags = ["Animation", "Motion Design", "Video Editing"];
const tech = ["React", "TypeScript", "Firebase"];

assert.equal(commaSeparated(tags), "Animation, Motion Design, Video Editing");
assert.equal(commaSeparated(tech), "React, TypeScript, Firebase");
assert.deepEqual(tags, ["Animation", "Motion Design", "Video Editing"]);
assert.deepEqual(tech, ["React", "TypeScript", "Firebase"]);
assert.equal(commaSeparated(["  Brand  ", "", "Web"]), "Brand, Web");
assert.equal(commaSeparated([]), "");

console.log("comma list checks passed");
