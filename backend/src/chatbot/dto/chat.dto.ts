import { IsArray, IsString, ValidateNested, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ChatRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

export class TextToSpeechDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  voiceId?: string;
}

