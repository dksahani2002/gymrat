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
import { ExerciseApplicationService } from '../../application/exercise/exercise.application-service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../shared/decorators/current-user.decorator';
import {
  CreateExerciseDto,
  ListExercisesQueryDto,
  UpdateExerciseDto,
} from './dto/exercise.dto';

type RequestWithMeta = Request & { requestId?: string };

@ApiTags('exercises')
@ApiBearerAuth()
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExerciseApplicationService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list exercises' })
  @ApiResponse({ status: 200, description: 'Paginated exercise list' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListExercisesQueryDto,
  ) {
    return this.exercises.search({
      q: query.q,
      categoryId: query.categoryId,
      categorySlug: query.categorySlug,
      muscleGroupId: query.muscleGroupId,
      muscleGroupSlug: query.muscleGroupSlug,
      equipmentId: query.equipmentId,
      cursor: query.cursor,
      limit: query.limit,
      actorUserId: user.id,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'List exercise categories' })
  async categories() {
    return this.exercises.listCategories();
  }

  @Get('muscles')
  @ApiOperation({ summary: 'List muscle groups' })
  async muscles() {
    return this.exercises.listMuscles();
  }

  @Get('equipment')
  @ApiOperation({ summary: 'List equipment' })
  async equipment() {
    return this.exercises.listEquipment();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exercise detail with muscles and aliases' })
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.exercises.getById(id, user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create exercise (custom for users; global catalog for admins)',
  })
  @ApiResponse({ status: 201, description: 'Exercise created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExerciseDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.exercises.create({
      actorUserId: user.id,
      actorRole: user.role,
      name: dto.name,
      description: dto.description,
      categoryId: dto.categoryId,
      equipmentId: dto.equipmentId,
      aliases: dto.aliases,
      muscles: dto.muscles,
      asCustom: dto.asCustom,
      context: this.contextFrom(req),
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update exercise (owner or admin)' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDto,
    @Req() req: RequestWithMeta,
  ) {
    return this.exercises.update({
      actorUserId: user.id,
      actorRole: user.role,
      exerciseId: id,
      name: dto.name,
      description: dto.description,
      categoryId: dto.categoryId,
      equipmentId: dto.equipmentId,
      isActive: dto.isActive,
      aliases: dto.aliases,
      muscles: dto.muscles,
      context: this.contextFrom(req),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete exercise (owner or admin)' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.exercises.softDelete({
      actorUserId: user.id,
      actorRole: user.role,
      exerciseId: id,
      context: this.contextFrom(req),
    });
  }

  private contextFrom(req: RequestWithMeta) {
    return {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: req.requestId ?? null,
    };
  }
}
