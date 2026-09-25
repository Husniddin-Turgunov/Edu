export type ResultsGroup = "employees" | "interns" | "candidates";

export function isResultsGroup(v: string): v is ResultsGroup {
  return v === "employees" || v === "interns" || v === "candidates";
}
