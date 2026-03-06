import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatementsService } from './statements.service';

const uploadDir = process.env.UPLOAD_DIR || './uploads';

@Controller('statements')
@UseGuards(JwtAuthGuard)
export class StatementsController {
  constructor(private statementsService: StatementsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${path.extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(new BadRequestException('Only PDF files are accepted'), false);
        } else {
          cb(null, true);
        }
      },
      limits: {
        fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '20') * 1024 * 1024),
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.statementsService.createUpload(req.user.id, file);
  }

  @Get()
  findAll(@Request() req) {
    return this.statementsService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.statementsService.findOne(req.user.id, id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.statementsService.deleteOne(req.user.id, id);
  }
}
