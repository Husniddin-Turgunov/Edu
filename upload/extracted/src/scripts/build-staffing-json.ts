import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

type StaffItem = {
  code: string;
  role: string;
  department: string;
  name: string | null;
  email: string | null;
};

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(value: unknown) {
  return clean(value)
    .replace(/\s*\((?:ю|Ю)клатилган\s*\)\s*/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validEmail(value: unknown) {
  const email = clean(value).toLowerCase();
  return email.includes("@") ? email : null;
}

function main() {
  const input = process.argv[2];
  if (!input) {
    throw new Error("Usage: tsx build-staffing-json.ts <staffing.xlsx>");
  }

  const workbook = XLSX.readFile(input);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[sheetName],
    { header: 1, raw: false },
  );

  const employees: StaffItem[] = [];
  const vacancies: StaffItem[] = [];
  const positions: StaffItem[] = [];
  let department = "AKELA GROUP";

  for (const row of rows.slice(5)) {
    const [number, codeValue, roleValue, , nameValue, emailValue] = row;
    const code = clean(codeValue);
    const role = clean(roleValue);

    if (
      typeof number === "string" &&
      !code &&
      !role &&
      !number.toLowerCase().includes("всего")
    ) {
      department = clean(number);
      continue;
    }

    if (!/^\d+(?:[.,]\d+)?$/.test(clean(number)) || !code || !role) {
      continue;
    }

    const name = cleanName(nameValue);
    const item: StaffItem = {
      code,
      role,
      department,
      name: name && name.toLowerCase() !== "вакант" ? name : null,
      email: validEmail(emailValue),
    };

    positions.push(item);
    if (item.name) employees.push(item);
    else vacancies.push(item);
  }

  const output = path.join(process.cwd(), "src", "data", "staffing.json");
  fs.writeFileSync(
    output,
    `${JSON.stringify(
      {
        version: "2026-08-14",
        source: path.basename(input),
        positions,
        employees,
        vacancies,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Generated ${output}: ${employees.length} occupied positions, ${vacancies.length} vacancies.`,
  );
}

main();
