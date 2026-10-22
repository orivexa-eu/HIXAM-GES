import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  ok() {
    return { status: 'ok' };
  }
}
