import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Demo users
  await prisma.user.upsert({
    where: { email: "student@demo.local" },
    update: {},
    create: { email: "student@demo.local", role: Role.student },
  });

  await prisma.user.upsert({
    where: { email: "admin@demo.local" },
    update: {},
    create: { email: "admin@demo.local", role: Role.admin },
  });

  // Policies: what each role is allowed to see (authorized schema snapshot)
  await prisma.policy.upsert({
    where: { role: Role.student },
    update: {},
    create: {
      role: Role.student,
      allowed: {
        databases: [
          {
            name: "analytics",
            tables: [{ name: "public_sales", columns: ["id", "month", "amount", "region"] }],
            scopeRules: [{ type: "region_eq_claim", claim: "region" }],
          },
        ],
      },
    },
  });

  await prisma.policy.upsert({
    where: { role: Role.admin },
    update: {},
    create: {
      role: Role.admin,
      allowed: {
        databases: [
          {
            name: "analytics",
            tables: [
              { name: "public_sales", columns: ["id", "month", "amount", "region"] },
              { name: "hr_salaries", columns: ["id", "employee_id", "email", "salary", "ssn"] },
            ],
          },
        ],
      },
    },
  });

  // Tool registry placeholder (later: hash your MCP tool binary/container)
  await prisma.toolRegistry.upsert({
    where: { toolName: "sql_runner" },
    update: { sha256: "PLACEHOLDER_HASH_CHANGE_LATER" },
    create: { toolName: "sql_runner", sha256: "PLACEHOLDER_HASH_CHANGE_LATER" },
  });

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
