import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CalendarApplicationService } from '../../application/calendar/calendar.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import {
  CalendarRangeQueryDto,
  CreatePlannedWorkoutDto,
  UpdatePlannedWorkoutDto,
} from './dto/calendar.dto';

type RequestWithMeta = Request & { requestId?: string };

@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarApplicationService) {}

  @Get()
  @ApiOperation({
    summary: 'Calendar range: completed workouts + planned markers',
  })
  range(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarRangeQueryDto,
  ) {
    return this.calendar.getRange({
      userId: user.id,
      from: query.from.slice(0, 10),
      to: query.to.slice(0, 10),
    });
  }

  @Post('planned')
  @ApiOperation({ summary: 'Create a planned workout marker' })
  @ApiResponse({ status: 201 })
  createPlanned(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlannedWorkoutDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.calendar.createPlanned({
      userId: user.id,
      plannedDate: dto.plannedDate.slice(0, 10),
      title: dto.title,
      notes: dto.notes,
      context: this.contextFrom(req),
    });
  }

  @Patch('planned/:id')
  @ApiOperation({ summary: 'Update a planned workout marker' })
  updatePlanned(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlannedWorkoutDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.calendar.updatePlanned({
      userId: user.id,
      id,
      plannedDate: dto.plannedDate?.slice(0, 10),
      title: dto.title,
      notes: dto.notes,
      context: this.contextFrom(req),
    });
  }

  @Delete('planned/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a planned workout marker' })
  @ApiResponse({ status: 204 })
  async deletePlanned(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.calendar.deletePlanned(user.id, id, this.contextFrom(req));
  }

  private contextFrom(req: RequestWithMeta) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    };
  }
}
