import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { migrate } from './db/migrate';

async function bootstrap() {
  await migrate();
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3000, '0.0.0.0');
  console.log('HIXAM-GES API on :3000');
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
