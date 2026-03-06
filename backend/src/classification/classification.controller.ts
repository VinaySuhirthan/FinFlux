import { Controller, Post, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ClassificationService } from './classification.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('classification')
@UseGuards(JwtAuthGuard)
export class ClassificationController {
  constructor(
    private classification: ClassificationService,
    private prisma: PrismaService,
  ) {}

  @Post('reprocess/:statementId')
  async reprocess(@Param('statementId') statementId: string, @Request() req) {
    // Verify statement belongs to user
    const statement = await this.prisma.statementUpload.findFirst({
      where: { id: statementId, userId: req.user.id },
    });
    if (!statement) return { error: 'Statement not found' };

    const updated = await this.classification.reprocessStatement(statementId);
    return { updated };
  }
}
