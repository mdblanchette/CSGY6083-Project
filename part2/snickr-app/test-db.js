const path = require("path");
const fs = require("fs");

// lightweight .env loader (avoids adding dotenv dep)
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  env.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const m = trimmed.match(/^([^=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      // remove surrounding quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const { PrismaClient } = require("@prisma/client");

(async () => {
  const prisma = new PrismaClient();
  try {
    const res = await prisma.$queryRawUnsafe("SELECT 1 as result");
    console.log("DB response:", res);
    process.exit(0);
  } catch (err) {
    console.error("DB error:", err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
