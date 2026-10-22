const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { DashboardService } = require('./dist/src/dashboard/dashboard.service');
const { TenantContext } = require('./dist/src/tenants/tenant.context');

const tenantId = '51900d01-1e46-4f36-9625-9759285d5f64'; // demo-school

async function main() {
  console.log('--- TESTING DASHBOARD SUMMARY EXECUTIONS ---');
  
  // Create instance of DashboardService (simulating NestJS service)
  const dashboardService = new DashboardService(prisma, { isTeacher: () => false });

  // Run warm-up
  await new Promise((resolve) => {
    TenantContext.run(tenantId, async () => {
      dashboardService.invalidateCache(tenantId);
      await dashboardService.getDashboardSummary();
      resolve();
    });
  });

  // Measured run
  const start = performance.now();
  let result;
  await new Promise((resolve) => {
    TenantContext.run(tenantId, async () => {
      dashboardService.invalidateCache(tenantId);
      result = await dashboardService.getDashboardSummary();
      resolve();
    });
  });
  const duration = performance.now() - start;

  console.log(`\nExecution Time: ${duration.toFixed(2)} ms`);
  console.log('Dashboard Summary Output Keys & Sample Values:');
  console.log({
    stats: result.stats,
    recentAdmissionsCount: result.recentAdmissions?.length,
    recentPaymentsCount: result.recentPayments?.length,
    chartDataCount: result.chartData?.length,
  });

  await prisma.$disconnect();
}

main().catch(console.error);
