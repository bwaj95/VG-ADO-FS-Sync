import dotenv from "dotenv";

export function loadEnv() {
  dotenv.config();
  if (
    !process.env.FS_API_KEY ||
    !process.env.FS_DOMAIN ||
    !process.env.MAPPING_EXCEL_FILE
  ) {
    console.warn("⚠️ Warning: Missing some environment variables.");
  }
  console.log("✅ Environment variables loaded.");
}
