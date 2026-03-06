import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/create-rule.dto';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.classificationRule.findMany({
      where: { OR: [{ userId }, { isSystem: true }] },
      include: { category: true },
      orderBy: [{ isSystem: 'asc' }, { priority: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateRuleDto) {
    return this.prisma.classificationRule.create({
      data: {
        userId,
        pattern: dto.pattern.toLowerCase(),
        patternType: dto.patternType,
        categoryId: dto.categoryId,
        priority: dto.priority ?? 50,
        isActive: true,
        isSystem: false,
      },
      include: { category: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateRuleDto) {
    const rule = await this.prisma.classificationRule.findFirst({
      where: { id, userId, isSystem: false },
    });
    if (!rule) throw new NotFoundException('Rule not found or cannot be modified');

    return this.prisma.classificationRule.update({
      where: { id },
      data: {
        ...(dto.pattern !== undefined && { pattern: dto.pattern.toLowerCase() }),
        ...(dto.patternType !== undefined && { patternType: dto.patternType }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });
  }

  async delete(userId: string, id: string) {
    const rule = await this.prisma.classificationRule.findFirst({
      where: { id, userId, isSystem: false },
    });
    if (!rule) throw new NotFoundException('Rule not found or cannot be deleted');
    await this.prisma.classificationRule.delete({ where: { id } });
    return { deleted: true };
  }
}
