import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PersonalRecordsApplicationService } from '../../application/personal-records/personal-records.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import { ListPersonalRecordsQueryDto } from './dto/personal-record.dto';

@ApiTags('personal-records')
@ApiBearerAuth()
@Controller('personal-records')
export class PersonalRecordsController {
  constructor(private readonly personalRecords: PersonalRecordsApplicationService) {}

  @Get()
  @ApiOperation({ summary: 'List personal records (filters + cursor)' })
  @ApiResponse({ status: 200, description: 'PR history page' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPersonalRecordsQueryDto,
  ) {
    return this.personalRecords.list({
      userId: user.id,
      exerciseId: query.exerciseId,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Current best PR per exercise and type' })
  @ApiResponse({ status: 200, description: 'Latest bests summary' })
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return this.personalRecords.summary(user.id);
  }
}
