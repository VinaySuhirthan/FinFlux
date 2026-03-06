import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RulesService } from './rules.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/create-rule.dto';

@Controller('rules')
@UseGuards(JwtAuthGuard)
export class RulesController {
  constructor(private rulesService: RulesService) {}

  @Get()
  findAll(@Request() req) {
    return this.rulesService.findAll(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateRuleDto, @Request() req) {
    return this.rulesService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRuleDto, @Request() req) {
    return this.rulesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.rulesService.delete(req.user.id, id);
  }
}
