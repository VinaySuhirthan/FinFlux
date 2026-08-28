import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { Direction } from '@prisma/client';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly ollamaBaseUrl: string;
  private readonly model = 'gemma4:31b-cloud';

  constructor(
    private httpService: HttpService,
    private analyticsService: AnalyticsService,
    private prisma: PrismaService,
  ) {
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  private getElevenLabsApiKey(): string | undefined {
    return (
      process.env.ELEVENLABS_API_KEY ||
      process.env.ELEVEN_LABS_API_KEY ||
      process.env.eleven_lab ||
      process.env.ELEVEN_LAB ||
      process.env.eleve_lab ||
      process.env.ELEVE_LAB
    );
  }

  /**
   * Convert text to speech using ElevenLabs API.
   */
  async textToSpeech(text: string, voiceId?: string): Promise<Buffer> {
    const apiKey = this.getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API key is not configured. Please set ELEVENLABS_API_KEY in .env');
    }

    // Clean markdown formatting for spoken clarity
    const cleanText = text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/[-*•]\s+/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    const voice = voiceId || 'JBFqnCBsd6RMkjVDRZzb';

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
        {
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 60000,
        },
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      const errorMsg = error.response?.data
        ? Buffer.from(error.response.data).toString()
        : error.message;
      this.logger.error(`ElevenLabs TTS error: ${errorMsg}`);
      throw new Error(`Failed to generate speech audio from ElevenLabs: ${errorMsg}`);
    }
  }

  /**
   * Transcribe recorded audio to text using ElevenLabs Scribe / STT API.
   */
  async speechToText(fileBuffer: Buffer, filename: string = 'audio.webm'): Promise<{ text: string }> {
    const apiKey = this.getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API key is not configured. Please set ELEVENLABS_API_KEY in .env');
    }

    try {
      const formData = new FormData();
      const uint8 = new Uint8Array(fileBuffer);
      const blob = new Blob([uint8], { type: 'audio/webm' });
      formData.append('file', blob, filename);
      formData.append('model_id', 'scribe_v1');

      const response = await axios.post('https://api.elevenlabs.io/v1/speech-to-text', formData, {
        headers: {
          'xi-api-key': apiKey,
        },
        timeout: 60000,
      });

      return { text: response.data?.text || '' };
    } catch (error: any) {
      this.logger.error(
        `ElevenLabs STT error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
      );
      throw new Error('Failed to transcribe speech audio.');
    }
  }

  /**
   * Gather all financial data for the user to inject into the system prompt.
   */
  private async gatherFinancialContext(userId: string): Promise<string> {
    const [summary, categories, monthlyTrend, topMerchants, recentTransactions] =
      await Promise.all([
        this.analyticsService.getSummary(userId),
        this.analyticsService.getCategoryBreakdown(userId),
        this.analyticsService.getMonthlyTrend(userId),
        this.analyticsService.getTopMerchants(userId, undefined, undefined, 15),
        this.prisma.transaction.findMany({
          where: { statement: { userId } },
          select: {
            txnDate: true,
            description: true,
            debitAmount: true,
            creditAmount: true,
            direction: true,
            category: { select: { name: true } },
          },
          orderBy: { txnDate: 'desc' },
          take: 100,
        }),
      ]);

    const formattedTransactions = recentTransactions.map((t) => ({
      date: new Date(t.txnDate).toISOString().split('T')[0],
      description: t.description,
      amount:
        t.direction === Direction.DEBIT
          ? Number(t.debitAmount ?? 0)
          : Number(t.creditAmount ?? 0),
      type: t.direction === Direction.DEBIT ? 'Expense' : 'Income',
      category: t.category?.name ?? 'Uncategorized',
    }));

    const categoryBreakdown = categories.map((c: any) => ({
      category: c.category?.name ?? 'Uncategorized',
      totalSpent: c.total,
      transactionCount: c.count,
    }));

    const context = `
=== USER'S FINANCIAL DATA (REAL DATA — DO NOT INVENT OR MODIFY) ===

OVERALL SUMMARY:
- Total Income: ₹${summary.totalIncome.toLocaleString('en-IN')}
- Total Expenses: ₹${summary.totalExpense.toLocaleString('en-IN')}
- Net Flow (Income - Expenses): ₹${summary.netFlow.toLocaleString('en-IN')}
- Total Transactions: ${summary.transactionCount}
- Uncategorized Transactions: ${summary.uncategorizedCount}

SPENDING BY CATEGORY:
${categoryBreakdown.map((c) => `- ${c.category}: ₹${c.totalSpent.toLocaleString('en-IN')} (${c.transactionCount} transactions)`).join('\n')}

MONTHLY INCOME & EXPENSE TREND:
${monthlyTrend.map((m: any) => `- ${m.month}: Income ₹${m.income.toLocaleString('en-IN')} | Expenses ₹${m.expense.toLocaleString('en-IN')} | Net ₹${(m.income - m.expense).toLocaleString('en-IN')}`).join('\n')}

TOP MERCHANTS/PAYEES BY SPENDING:
${topMerchants.map((m: any, i: number) => `${i + 1}. ${m.name}: ₹${m.total.toLocaleString('en-IN')} (${m.count} transactions)`).join('\n')}

RECENT TRANSACTIONS (last 100):
${formattedTransactions.map((t) => `- ${t.date} | ${t.type} | ${t.category} | ₹${t.amount.toLocaleString('en-IN')} | ${t.description}`).join('\n')}

=== END OF FINANCIAL DATA ===
`;

    return context;
  }

  /**
   * Build the system prompt for the AI financial analyst.
   */
  private buildSystemPrompt(financialContext: string): string {
    return `You are FinFlux AI — a personal AI financial analyst embedded in the FinFlux personal finance application. You have access to the user's complete, real financial data provided below.

CRITICAL RULES:
1. NEVER invent, fabricate, or hallucinate any financial data. Every number, amount, category, and transaction you mention MUST come from the data provided below.
2. Always reference specific numbers from the data when answering questions.
3. If the data doesn't contain information to answer a question, say so honestly.
4. Use Indian Rupee (₹) formatting with Indian number system (lakhs, thousands).
5. Be conversational but professional. You are a financial analyst, not a generic chatbot.
6. When suggesting savings, be specific — mention exact categories, amounts, and actionable steps.
7. Keep responses concise but insightful. Use bullet points and formatting for clarity.
8. When the user asks follow-up questions, use the conversation context to understand what they're referring to.

${financialContext}

You are now ready to answer any questions about this user's finances. Be proactive with insights and suggestions when relevant.`;
  }

  /**
   * Send a chat request to Ollama and return the AI response.
   */
  async chat(
    userId: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ role: string; content: string }> {
    const financialContext = await this.gatherFinancialContext(userId);
    const systemPrompt = this.buildSystemPrompt(financialContext);

    const ollamaMessages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.ollamaBaseUrl}/api/chat`,
          {
            model: this.model,
            messages: ollamaMessages,
            stream: false,
            options: {
              temperature: 0.3,
              top_p: 0.9,
              num_predict: 1024,
            },
          },
          { timeout: 120000 },
        ),
      );

      return {
        role: 'assistant',
        content: response.data.message?.content ?? 'I was unable to generate a response. Please try again.',
      };
    } catch (error: any) {
      this.logger.error(`Ollama API error: ${error.message}`);

      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Unable to connect to the AI model. Please ensure Ollama is running with the gemma4:31b-cloud model.',
        );
      }

      throw new Error(
        'An error occurred while generating the AI response. Please try again.',
      );
    }
  }

  /**
   * Generate proactive financial insights without the user asking.
   */
  async generateInsights(userId: string): Promise<{ content: string }> {
    const financialContext = await this.gatherFinancialContext(userId);

    const insightPrompt = `You are FinFlux AI — a personal AI financial analyst. Analyze the user's financial data below and generate exactly 3-5 key proactive insights.

CRITICAL RULES:
1. NEVER invent or hallucinate data. Only use the numbers provided below.
2. Use ₹ with Indian number formatting.
3. Be specific with amounts and percentages.

For each insight, provide:
- A clear observation grounded in the data
- Why it matters
- A specific, actionable suggestion

Format your response as a brief welcome message followed by the insights. Keep it concise and impactful. Use bullet points.

${financialContext}

Generate the insights now:`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.ollamaBaseUrl}/api/chat`,
          {
            model: this.model,
            messages: [{ role: 'user', content: insightPrompt }],
            stream: false,
            options: {
              temperature: 0.4,
              top_p: 0.9,
              num_predict: 800,
            },
          },
          { timeout: 120000 },
        ),
      );

      return {
        content:
          response.data.message?.content ??
          'Welcome! I have access to your financial data and I\'m ready to help. Ask me anything about your spending, income, or financial habits.',
      };
    } catch (error: any) {
      this.logger.error(`Ollama insights error: ${error.message}`);
      return {
        content:
          'Welcome to FinFlux AI! I\'m your personal financial analyst. I can help you understand your spending patterns, identify savings opportunities, and answer any questions about your finances. Try asking me something!',
      };
    }
  }
}
