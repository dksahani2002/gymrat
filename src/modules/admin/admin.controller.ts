import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnalyticsApplicationService } from '../../application/analytics/analytics.application-service';
import { Role } from '../../domain/identity/role.enum';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RecomputeAnalyticsDto } from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly analytics: AnalyticsApplicationService) {}

  @Post('analytics/recompute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recompute analytics snapshots for a user date range (ADMIN)',
  })
  @ApiResponse({ status: 200, description: 'Number of local days recomputed' })
  @ApiResponse({ status: 403, description: 'Non-admin caller' })
  recompute(@Body() dto: RecomputeAnalyticsDto) {
    return this.analytics.recomputeRange({
      userId: dto.userId,
      from: dto.from.slice(0, 10),
      to: dto.to.slice(0, 10),
    });
  }
}
