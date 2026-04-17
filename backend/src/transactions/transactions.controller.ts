import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
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

  @Get('transactions/all')
  getAllTransactions(
    @Request() req,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('direction') direction?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.transactionsService.findAllForUser(req.user.id, {
      categoryId,
      search,
      dateFrom,
      dateTo,
      direction: direction as 'DEBIT' | 'CREDIT' | undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    });
  }

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

  @Patch('transactions/:id')
  updateTransaction(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: import('./dto/update-transaction.dto').UpdateTransactionDto,
  ) {
    return this.transactionsService.updateTransaction(req.user.id, id, dto);
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

  @Delete('transactions/:id')
  deleteTransaction(
    @Request() req,
    @Param('id') id: string,
  ) {
    return this.transactionsService.deleteTransaction(req.user.id, id);
  }

  @Get('categories')
  getCategories() {
    return this.transactionsService.getCategories();
  }
}
