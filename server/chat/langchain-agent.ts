import { ChatAnthropic } from '@langchain/anthropic';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import { BookingToolManager } from '../tools/booking-tool.js';

export class BookingAgent {
  private agent: AgentExecutor | null = null;
  private memory: BufferMemory;
  private bookingToolManager: BookingToolManager;

  constructor(apiKey: string, username: string, password: string) {
    this.memory = new BufferMemory({
      memoryKey: 'chat_history',
      returnMessages: true,
    });

    this.bookingToolManager = new BookingToolManager(username, password);
  }

  async initialize() {
    // Initialize the booking tool
    await this.bookingToolManager.initialize();

    // Create the LLM
    const llm = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-20250514',
      temperature: 0.7,
    });

    // Create the booking tool
    const tools = [this.bookingToolManager.createTool()];

    // Create the prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a helpful assistant that books tennis and pickleball courts at Bay Club Gateway.

Today's date is Tuesday, February 10, 2026. Use this information to calculate dates when users say things like:
- "today" = Tuesday, February 10, 2026
- "tomorrow" = Wednesday, February 11, 2026
- "thursday" = Thursday, February 12, 2026
- "next monday" = Monday, February 17, 2026

You have access to a tool that can:
1. Query available court times for tennis or pickleball on any date
2. Book courts with Samuel Wang as a buddy

When a user asks about booking, first check available times, then help them book a specific slot.

Be conversational and friendly. Remember context from earlier in the conversation.

Key info:
- Tennis bookings are 90 minutes
- Pickleball bookings are 60 minutes
- All bookings are at the Gateway club in San Francisco
- Samuel Wang is automatically added as a buddy

Examples:
- User: "Can I book a pickleball court on Thursday?"
  You: Use the tool to query available times for pickleball on Thursday, Feb 12

- User: "Book 2pm"
  You: If they mentioned a sport and date earlier, use that context to book at 2pm

- User: "What times are available for tennis tomorrow?"
  You: Query available tennis times for Wednesday, Feb 11`
      ],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}']
    ]);

    // Create the agent
    const agent = await createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    // Create the agent executor (memory is handled manually to avoid output key issues)
    this.agent = new AgentExecutor({
      agent,
      tools,
      verbose: true,
      maxIterations: 5,
    });
  }

  async chat(message: string): Promise<string> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      // Get chat history
      const memoryVars = await this.memory.loadMemoryVariables({});
      
      const result = await this.agent.invoke({
        input: message,
        chat_history: memoryVars.chat_history || [],
      });

      // Extract the output text
      let output: string;
      if (typeof result.output === 'string') {
        output = result.output;
      } else if (Array.isArray(result.output)) {
        output = result.output.map((item: any) => item.text || item).join('\n');
      } else {
        output = 'Sorry, I could not process your request.';
      }

      // Save to memory manually
      await this.memory.saveContext(
        { input: message },
        { output }
      );

      return output;
    } catch (error) {
      console.error('Error in chat:', error);
      return `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async cleanup() {
    await this.bookingToolManager.cleanup();
  }
}
