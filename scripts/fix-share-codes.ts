import "dotenv/config";
import { fixGroupsShareCodes } from "../server/db";

async function main() {
  const updated = await fixGroupsShareCodes();
  console.log(`Done: ${updated} group(s) updated with a shareCode.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
