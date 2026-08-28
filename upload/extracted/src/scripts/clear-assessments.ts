/**
 * Wipe assessment library (tests, questions, related results/assignments).
 * Keeps employees, vacancies, candidates, competencies, levels.
 */
import {
  assignments,
  assessments,
  candidateAssignments,
  candidateResults,
  questions,
  results,
} from "../db/schema";
import { db } from "../db/index";

async function main() {
  await db.delete(candidateResults);
  await db.delete(candidateAssignments);
  await db.delete(results);
  await db.delete(assignments);
  await db.delete(questions);
  await db.delete(assessments);
  console.log("Assessment library cleared.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
