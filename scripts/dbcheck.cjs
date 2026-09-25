const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({ where: { email: 'admin@akelagroup.com' } })
  .then(u => { console.log('USER', JSON.stringify(u)); return p.$disconnect(); })
  .catch(e => { console.log('ERR', e.message.slice(0, 300)); return p.$disconnect(); });
