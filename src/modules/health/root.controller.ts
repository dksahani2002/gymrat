import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../shared/decorators/public.decorator';

/**
 * Root redirect so visiting http://localhost:3000 lands on a useful page.
 */
@ApiExcludeController()
@Controller()
export class RootController {
  @Public()
  @Get()
  redirect(@Res() res: Response): void {
    res.redirect(302, '/docs');
  }
}
