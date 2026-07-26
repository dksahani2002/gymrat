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
import { GoalsApplicationService } from '../../application/goals/goals.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import {
  CreateGoalDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
} from './dto/goal.dto';

type RequestWithMeta = Request & { requestId?: string };

@ApiTags('goals')
@ApiBearerAuth()
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsApplicationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a goal' })
  @ApiResponse({ status: 201, description: 'Created goal with progress' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.goals.create({
      userId: user.id,
      type: dto.type,
      title: dto.title,
      targetValue: dto.targetValue,
      targetUnit: dto.targetUnit,
      exerciseId: dto.exerciseId,
      startsAt: dto.startsAt,
      targetDate: dto.targetDate,
      context: this.contextFrom(req),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List goals' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListGoalsQueryDto,
  ) {
    return this.goals.list({
      userId: user.id,
      status: query.status,
      type: query.type,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get goal detail with progress' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goals.getById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a goal' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.goals.update({
      userId: user.id,
      goalId: id,
      title: dto.title,
      targetValue: dto.targetValue,
      targetUnit: dto.targetUnit,
      exerciseId: dto.exerciseId,
      startsAt: dto.startsAt,
      targetDate: dto.targetDate,
      status: dto.status,
      context: this.contextFrom(req),
    });
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a goal completed' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithMeta,
  ) {
    return this.goals.complete(user.id, id, this.contextFrom(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete (abandon) a goal' })
  @ApiResponse({ status: 204 })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.goals.softDelete(user.id, id, this.contextFrom(req));
  }

  private contextFrom(req: RequestWithMeta) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    };
  }
}
