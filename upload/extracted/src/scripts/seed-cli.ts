import { seedIfEmpty } from "../db/seed";

seedIfEmpty()
  .then(() => {
    console.log("Database ready.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
