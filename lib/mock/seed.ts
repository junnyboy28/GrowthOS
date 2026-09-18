try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional (e.g. in CI where DATABASE_URL is injected directly)
}

async function main() {
  console.log(
    "lib/mock/seed.ts is a placeholder — mock world seeding lands in Phase 1.",
  );
}

main();
