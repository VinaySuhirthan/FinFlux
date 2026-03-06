import { Module } from '@nestjs/common';
import { StatementsService } from './statements.service';
import { StatementsController } from './statements.controller';
import { ParserModule } from '../parser/parser.module';
import { ClassificationModule } from '../classification/classification.module';

@Module({
  imports: [ParserModule, ClassificationModule],
  providers: [StatementsService],
  controllers: [StatementsController],
})
export class StatementsModule {}
