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
import { WorkoutApplicationService } from '../../application/workout/workout.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import {
  CreateWorkoutDto,
  ListWorkoutsQueryDto,
  UpdateWorkoutDto,
  UpdateWorkoutExerciseDto,
  UpdateWorkoutSetDto,
  WorkoutExerciseDto,
  WorkoutSetDto,
} from './dto/workout.dto';

type RequestWithMeta = Request & { requestId?: string };

@ApiTags('workouts')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutApplicationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workout with nested exercises/sets' })
  @ApiResponse({ status: 201, description: 'Workout created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkoutDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.create({
      userId: user.id,
      title: dto.title,
      notes: dto.notes,
      source: dto.source,
      startedAt: dto.startedAt,
      completed: dto.completed,
      idempotencyKey: dto.idempotencyKey,
      exercises: dto.exercises,
      context: this.contextFrom(req),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List workout history (cursor pagination)' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWorkoutsQueryDto,
  ) {
    return this.workouts.list({
      userId: user.id,
      status: query.status,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workout detail' })
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workouts.getById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workout metadata and/or replace exercises' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.update({
      userId: user.id,
      workoutId: id,
      title: dto.title,
      notes: dto.notes,
      startedAt: dto.startedAt,
      exercises: dto.exercises,
      context: this.contextFrom(req),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a workout' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.workouts.softDelete(user.id, id, this.contextFrom(req));
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Mark workout completed and emit workout.completed',
  })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.complete(user.id, id, this.contextFrom(req));
  }

  @Post(':id/exercises')
  @ApiOperation({ summary: 'Add an exercise to a workout' })
  async addExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WorkoutExerciseDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.addExercise(user.id, id, dto, this.contextFrom(req));
  }

  @Patch(':id/exercises/:exerciseId')
  @ApiOperation({ summary: 'Update workout exercise position/notes' })
  async updateExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() dto: UpdateWorkoutExerciseDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.updateExercise(
      user.id,
      id,
      exerciseId,
      dto,
      this.contextFrom(req),
    );
  }

  @Delete(':id/exercises/:exerciseId')
  @ApiOperation({ summary: 'Remove an exercise from a workout' })
  async removeExercise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.removeExercise(
      user.id,
      id,
      exerciseId,
      this.contextFrom(req),
    );
  }

  @Post(':id/exercises/:exerciseId/sets')
  @ApiOperation({ summary: 'Add a set to a workout exercise' })
  async addSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() dto: WorkoutSetDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.addSet(
      user.id,
      id,
      exerciseId,
      dto,
      this.contextFrom(req),
    );
  }

  @Patch(':id/sets/:setId')
  @ApiOperation({ summary: 'Update a set' })
  async updateSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
    @Body() dto: UpdateWorkoutSetDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.updateSet(
      user.id,
      id,
      setId,
      dto,
      this.contextFrom(req),
    );
  }

  @Delete(':id/sets/:setId')
  @ApiOperation({ summary: 'Delete a set' })
  async removeSet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
    @Req() req: RequestWithMeta,
  ) {
    return this.workouts.removeSet(user.id, id, setId, this.contextFrom(req));
  }

  private contextFrom(req: RequestWithMeta) {
    return {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: req.requestId ?? null,
    };
  }
}
