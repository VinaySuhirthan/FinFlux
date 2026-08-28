import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto, TextToSpeechDto } from './dto/chat.dto';

@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(private chatbotService: ChatbotService) {}

  @Post('chat')
  async chat(@Request() req, @Body() body: ChatRequestDto) {
    try {
      return await this.chatbotService.chat(req.user.id, body.messages);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to get AI response',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('insights')
  async insights(@Request() req) {
    return this.chatbotService.generateInsights(req.user.id);
  }

  @Post('tts')
  async textToSpeech(@Body() body: TextToSpeechDto, @Res() res: Response) {
    if (!body.text) {
      throw new HttpException('Text is required for TTS', HttpStatus.BAD_REQUEST);
    }
    try {
      const audioBuffer = await this.chatbotService.textToSpeech(body.text, body.voiceId);
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });
      res.end(audioBuffer);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'TTS generation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('stt')
  @UseInterceptors(FileInterceptor('file'))
  async speechToText(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('Audio file is required for STT', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.chatbotService.speechToText(file.buffer, file.originalname);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'STT transcription failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

