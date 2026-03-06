import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { BulkCategorizeDto } from './dto/bulk-categorize.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get('statements/:statementId/transactions')
  findByStatement(
    @Request() req,
    @Param('statementId') statementId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findByStatement(req.user.id, statementId, {
      categoryId,
      search,
      dateFrom,
      dateTo,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Patch('transactions/:id/category')
  updateCategory(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.transactionsService.updateCategory(req.user.id, id, dto.categoryId);
  }

  @Post('transactions/bulk-categorize')
  bulkCategorize(@Request() req, @Body() dto: BulkCategorizeDto) {
    return this.transactionsService.bulkCategorize(
      req.user.id,
      dto.transactionIds,
      dto.categoryId,
    );
  }

  @Get('categories')
  getCategories() {
    return this.transactionsService.getCategories();
  }
}
