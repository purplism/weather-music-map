import fs from "node:fs/promises";
import path from "node:path";

function roundSeconds(value) {
  return Math.round(value * 1000000) / 1000000;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function assertFileExists(filePath, label) {
  try {
    const stats = await fs.stat(filePath);

    return {
      label,
      path: filePath,
      sizeMb: Math.round((stats.size / 1024 / 1024) * 10) / 10,
    };
  } catch {
    throw new Error(`${label} is missing: ${filePath}`);
  }
}

function validateSections(sectionsData) {
  const [beatsPerBar] = sectionsData.meter;
  const expectedBarDuration = 60 / sectionsData.tempoBpm * beatsPerBar;
  const errors = [];
  let expectedStartBar = 1;

  sectionsData.sections.forEach((section) => {
    const expectedStartSeconds = roundSeconds(
      (section.startBar - 1) * expectedBarDuration
    );
    const expectedEndSeconds = roundSeconds(
      expectedStartSeconds + section.barCount * expectedBarDuration
    );

    if (section.startBar !== expectedStartBar) {
      errors.push(
        `${section.name} starts at bar ${section.startBar}, expected ${expectedStartBar}`
      );
    }

    if (Math.abs(section.startSeconds - expectedStartSeconds) > 0.00001) {
      errors.push(
        `${section.name} startSeconds ${section.startSeconds}, expected ${expectedStartSeconds}`
      );
    }

    if (
      section.name !== "Fadeout / End Tail" &&
      Math.abs(section.endSeconds - expectedEndSeconds) > 0.00001
    ) {
      errors.push(
        `${section.name} endSeconds ${section.endSeconds}, expected ${expectedEndSeconds}`
      );
    }

    expectedStartBar += section.barCount;
  });

  if (expectedStartBar - 1 !== sectionsData.totalBars) {
    errors.push(
      `section bars total ${expectedStartBar - 1}, expected ${sectionsData.totalBars}`
    );
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return {
    sectionCount: sectionsData.sections.length,
    totalBars: sectionsData.totalBars,
    barDurationSeconds: roundSeconds(expectedBarDuration),
  };
}

const datasetId = process.argv[2];

if (!datasetId) {
  throw new Error("Usage: node scripts/dataset/validateDataset.mjs <dataset-id>");
}

const datasetDir = path.resolve("datasets", datasetId);
const manifest = await readJson(path.join(datasetDir, "manifest.json"));
const sections = await readJson(path.join(datasetDir, "analysis", "sections.json"));
const sources = await Promise.all([
  assertFileExists(manifest.sourceFiles.fullMix, "full mix"),
  assertFileExists(manifest.sourceFiles.stemsZip, "stems zip"),
  assertFileExists(manifest.sourceFiles.midiZip, "MIDI zip"),
]);
const sectionSummary = validateSections(sections);

console.log(
  JSON.stringify(
    {
      datasetId,
      title: manifest.title,
      sources,
      sections: sectionSummary,
      status: "valid",
    },
    null,
    2
  )
);
