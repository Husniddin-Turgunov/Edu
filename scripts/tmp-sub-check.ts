import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const subs = await (p as any).botSubscriber.findMany();
  console.log(JSON.stringify(subs, null, 2));
  await p.$disconnect();
})();
