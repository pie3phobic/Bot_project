//main
// import { NextRequest, NextResponse } from "next/server";
// import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

// import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
// import { ChatOpenAI } from "@langchain/openai";
// import { SerpAPI } from "@langchain/community/tools/serpapi";
// import { Calculator } from "langchain/tools/calculator";
// import { AIMessage, ChatMessage, HumanMessage } from "@langchain/core/messages";

// import {
//   ChatPromptTemplate,
//   MessagesPlaceholder,
// } from "@langchain/core/prompts";

// export const runtime = "edge";

// const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
//   if (message.role === "user") {
//     return new HumanMessage(message.content);
//   } else if (message.role === "assistant") {
//     return new AIMessage(message.content);
//   } else {
//     return new ChatMessage(message.content, message.role);
//   }
// };

// const AGENT_SYSTEM_TEMPLATE = You are a talking parrot named Polly. All final responses must be how a talking parrot would respond. Squawk often!;

// /**
//  * This handler initializes and calls an OpenAI Functions agent.
//  * See the docs for more information:
//  *
//  * https://js.langchain.com/docs/modules/agents/agent_types/openai_functions_agent
//  */
// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     /**
//      * We represent intermediate steps as system messages for display purposes,
//      * but don't want them in the chat history.
//      */
//     const messages = (body.messages ?? []).filter(
//       (message: VercelChatMessage) =>
//         message.role === "user" || message.role === "assistant",
//     );
//     const returnIntermediateSteps = body.show_intermediate_steps;
//     const previousMessages = messages
//       .slice(0, -1)
//       .map(convertVercelMessageToLangChainMessage);
//     const currentMessageContent = messages[messages.length - 1].content;

//     // Requires process.env.SERPAPI_API_KEY to be set: https://serpapi.com/
//     // You can remove this or use a different tool instead.
//     const tools = [new Calculator(), new SerpAPI()];
//     const chat = new ChatOpenAI({
//       modelName: "gpt-3.5-turbo-1106",
//       temperature: 0,
//       // IMPORTANT: Must "streaming: true" on OpenAI to enable final output streaming below.
//       streaming: true,
//     });

//     /**
//      * Based on https://smith.langchain.com/hub/hwchase17/openai-functions-agent
//      *
//      * This default prompt for the OpenAI functions agent has a placeholder
//      * where chat messages get inserted as "chat_history".
//      *
//      * You can customize this prompt yourself!
//      */
//     const prompt = ChatPromptTemplate.fromMessages([
//       ["system", AGENT_SYSTEM_TEMPLATE],
//       new MessagesPlaceholder("chat_history"),
//       ["human", "{input}"],
//       new MessagesPlaceholder("agent_scratchpad"),
//     ]);

//     const agent = await createOpenAIFunctionsAgent({
//       llm: chat,
//       tools,
//       prompt,
//     });

//     const agentExecutor = new AgentExecutor({
//       agent,
//       tools,
//       // Set this if you want to receive all intermediate steps in the output of .invoke().
//       returnIntermediateSteps,
//     });

//     if (!returnIntermediateSteps) {
//       /**
//        * Agent executors also allow you to stream back all generated tokens and steps
//        * from their runs.
//        *
//        * This contains a lot of data, so we do some filtering of the generated log chunks
//        * and only stream back the final response.
//        *
//        * This filtering is easiest with the OpenAI functions or tools agents, since final outputs
//        * are log chunk values from the model that contain a string instead of a function call object.
//        *
//        * See: https://js.langchain.com/docs/modules/agents/how_to/streaming#streaming-tokens
//        */
//       const logStream = await agentExecutor.streamLog({
//         input: currentMessageContent,
//         chat_history: previousMessages,
//       });

//       const textEncoder = new TextEncoder();
//       const transformStream = new ReadableStream({
//         async start(controller) {
//           for await (const chunk of logStream) {
//             if (chunk.ops?.length > 0 && chunk.ops[0].op === "add") {
//               const addOp = chunk.ops[0];
//               if (
//                 addOp.path.startsWith("/logs/ChatOpenAI") &&
//                 typeof addOp.value === "string" &&
//                 addOp.value.length
//               ) {
//                 controller.enqueue(textEncoder.encode(addOp.value));
//               }
//             }
//           }
//           controller.close();
//         },
//       });

//       return new StreamingTextResponse(transformStream);
//     } else {
//       /**
//        * Intermediate steps are the default outputs with the executor's .stream() method.
//        * We could also pick them out from streamLog chunks.
//        * They are generated as JSON objects, so streaming them is a bit more complicated.
//        */
//       const result = await agentExecutor.invoke({
//         input: currentMessageContent,
//         chat_history: previousMessages,
//       });
//       return NextResponse.json(
//         { output: result.output, intermediate_steps: result.intermediateSteps },
//         { status: 200 },
//       );
//     }
//   } catch (e: any) {
//     return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
//   }
// }

//chat new
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Calculator } from "langchain/tools/calculator";
import { AIMessage, ChatMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Метрики
const metrics = {
  responseTimes: [],
  errorCount: 0,
  requestCount: 0,
  contextRetentionScore: 0,
  completedConversations: 0,
};

// Кеш для відповідей
const cache = {};

// Функція для кешування відповідей
const cacheResponse = (response) => {
  const cacheControlHeader = "s-maxage=3600, stale-while-revalidate"; // Кешувати на годину
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": cacheControlHeader,
    },
  });
};

// Перевірка на завершення діалогу
const detectCompletion = (message) => {
  const completionKeywords = ["thank you", "bye"];
  if (completionKeywords.some((word) => message.toLowerCase().includes(word))) {
    metrics.completedConversations++;
  }
};

//Перевірка утримання контексту (тестові запити)
const testContextRetention = (messages) => {
  const contextKeywords = ["what's my name", "can you repeat"];
  if (contextKeywords.some((word) => messages.includes(word))) {
    metrics.contextRetentionScore++;
  }
};

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const AGENT_SYSTEM_TEMPLATE = `You are a talking parrot named Polly. All final responses must be how a talking parrot would respond. Squawk often!`;

export async function POST(req: NextRequest) {
  try {
    metrics.requestCount++;
    const startTime = Date.now();

    const body = await req.json();
    const messages = (body.messages ?? []).filter(
      (message: VercelChatMessage) =>
        message.role === "user" || message.role === "assistant",
    );

    const currentMessageContent = messages[messages.length - 1].content;

    // Перевірка наявності запиту в кеші
    if (cache[currentMessageContent]) {
      console.log("Returning cached response for:", currentMessageContent);
      const endTime = Date.now();
      metrics.responseTimes.push(endTime - startTime);
      detectCompletion(currentMessageContent);
      return cacheResponse(cache[currentMessageContent]);
    }

    const returnIntermediateSteps = body.show_intermediate_steps;
    const previousMessages = messages
      .slice(0, -1)
      .map(convertVercelMessageToLangChainMessage);

    testContextRetention(previousMessages.map((msg) => msg.content));

    const tools = [new Calculator(), new SerpAPI()];
    const chat = new ChatOpenAI({
      modelName: "gpt-3.5-turbo-1106",
      temperature: 0,
      streaming: true,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", AGENT_SYSTEM_TEMPLATE],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm: chat,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      returnIntermediateSteps,
    });

    if (!returnIntermediateSteps) {
      const logStream = await agentExecutor.streamLog({
        input: currentMessageContent,
        chat_history: previousMessages,
      });

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const chunk of logStream) {
            if (chunk.ops?.length > 0 && chunk.ops[0].op === "add") {
              const addOp = chunk.ops[0];
              if (
                addOp.path.startsWith("/logs/ChatOpenAI") &&
                typeof addOp.value === "string" &&
                addOp.value.length
              ) {
                controller.enqueue(textEncoder.encode(addOp.value));
              }
            }
          }
          controller.close();
        },
      });

      const endTime = Date.now();
      metrics.responseTimes.push(endTime - startTime);
      return new StreamingTextResponse(transformStream);
    } else {
      const result = await agentExecutor.invoke({
        input: currentMessageContent,
        chat_history: previousMessages,
      });

      const endTime = Date.now();
      metrics.responseTimes.push(endTime - startTime);

      // Логування довжини виходу
      console.log("Output length:", JSON.stringify(result.output).length);

      // Зберігання відповіді в кеші
      cache[currentMessageContent] = {
        output: result.output,
        intermediate_steps: result.intermediateSteps,
      };

      detectCompletion(currentMessageContent);

      return cacheResponse(cache[currentMessageContent]);
    }
  } catch (e: any) {
    metrics.errorCount++;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// //tests
// export async function runTests() {
//   // Запити для перевірки різних метрик
//   const testInputs = [
//     // Базові запити
//     "Hello, parrot!",
//     "What is 2 + 2?",
//     "Tell me about the weather in New York.",
//     "What can you do?",

//     // Перевірка утримання контексту
//     "My name is Alex.",
//     "What's my name?",
//     "Remember this: I love programming.",
//     "What do I love?",

//     // Перевірка завершення діалогу
//     "Thank you.",
//     "Bye.",

//     // Складніші запити
//     "What is the result of 5 factorial?",
//     "What is 2 raised to the power of 10?",
//     "What is the current GDP of the USA?", // Використання інструменту SerpAPI
//     "Can you calculate the square root of 144?",

//     // Інші тести (можна додати більше)
//     "What time is it in Tokyo?",
//     "Can you recommend a movie for me?",
//     "What's the population of Canada?",
//   ];

//   // Обробка кожного запиту
//   for (const input of testInputs) {
//     await POST({
//       json: async () => ({ messages: [{ role: "user", content: input }] }),
//     } as unknown as NextRequest);
//   }

//   // Виведення зведених метрик
//   console.log("Final Metrics:", {
//     averageResponseTime:
//       metrics.responseTimes.reduce((a, b) => a + b, 0) /
//         metrics.responseTimes.length || 0,
//     errorCount: metrics.errorCount,
//     requestCount: metrics.requestCount,
//     contextRetentionScore: metrics.contextRetentionScore,
//     completedConversations: metrics.completedConversations,
//   });
// }

//improved test logic:

// import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
// import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
// import { ChatOpenAI } from "@langchain/openai";
// import { SerpAPI } from "@langchain/community/tools/serpapi";
// import { Calculator } from "langchain/tools/calculator";
// import { AIMessage, ChatMessage, HumanMessage } from "@langchain/core/messages";
// import {
//   ChatPromptTemplate,
//   MessagesPlaceholder,
// } from "@langchain/core/prompts";
// import { NextRequest, NextResponse } from "next/server";

// export const runtime = "edge";

// // Метрики
// const metrics = {
//   averageResponseTime: 0,
//   errorCount: 0,
//   requestCount: 0,
//   contextRetentionScore: 0,
//   completedConversations: 0,
//   cpuUsage: [],
//   memoryUsage: [],
// };

// // Функція для обчислення середнього часу відповіді
// const calculateAverageResponseTime = (totalTime: number) => {
//   if (metrics.requestCount > 0) {
//     metrics.averageResponseTime = totalTime / metrics.requestCount;
//   }
// };

// // Функція для визначення завершення діалогу
// const detectCompletion = (message: string) => {
//   const completionKeywords = ["thank you", "bye"];
//   if (completionKeywords.some((word) => message.toLowerCase().includes(word))) {
//     metrics.completedConversations++;
//   }
// };

// // Функція для перевірки утримання контексту
// const testContextRetention = (messages: string[]) => {
//   const contextKeywords = ["what's my name", "can you repeat"];
//   if (
//     messages.some((msg) =>
//       contextKeywords.some((word) => msg.toLowerCase().includes(word)),
//     )
//   ) {
//     metrics.contextRetentionScore++;
//   }
// };

// // Функція для відстеження ресурсів
// const monitorResources = () => {
//   const cpuUsage = process.cpuUsage(); // Використання CPU
//   const memoryUsage = process.memoryUsage().heapUsed; // Використання пам'яті (heap)

//   metrics.cpuUsage.push(cpuUsage.user + cpuUsage.system);
//   metrics.memoryUsage.push(memoryUsage);
// };

// // Обробка запитів
// const processRequest = (
//   previousMessages: any[],
//   currentMessageContent: string,
//   responseTime: number,
// ) => {
//   metrics.requestCount++;
//   calculateAverageResponseTime(responseTime);
//   testContextRetention(previousMessages.map((msg) => msg.content));
//   detectCompletion(currentMessageContent);
//   monitorResources();
// };

// // Дані для тестування
// const testInputs = Array.from(
//   { length: 100 },
//   (_, i) => `Test input #${i + 1}`,
// );

// // Симуляція роботи системи
// let totalResponseTime = 0;
// testInputs.forEach((input, index) => {
//   const responseTime = Math.floor(Math.random() * 10) + 1; // Випадковий час відповіді (1-10 мс)
//   totalResponseTime += responseTime;

//   const previousMessages = testInputs.slice(0, index).map((content) => ({
//     content,
//   }));
//   processRequest(previousMessages, input, responseTime);
// });

// // Виведення фінальних метрик
// const averageCpuUsage =
//   metrics.cpuUsage.reduce((a, b) => a + b, 0) / metrics.cpuUsage.length || 0;

// const averageMemoryUsage =
//   metrics.memoryUsage.reduce((a, b) => a + b, 0) / metrics.memoryUsage.length ||
//   0;

// console.log("Final Metrics:", {
//   ...metrics,
//   averageCpuUsage,
//   averageMemoryUsage,
// });

//tests without chaching
// import { performance } from "perf_hooks";

// // Метрики
// const metrics = {
//   averageResponseTime: 0,
//   errorCount: 0,
//   requestCount: 0,
//   contextRetentionScore: 0,
//   completedConversations: 0,
//   cpuUsage: [] as number[],
//   memoryUsage: [] as number[],
//   averageCpuUsage: 0,
//   averageMemoryUsage: 0,
// };

// // Функція для обрахунку середнього часу відповіді
// const calculateAverageResponseTime = (totalTime: number) => {
//   if (metrics.requestCount > 0) {
//     metrics.averageResponseTime = totalTime / metrics.requestCount;
//   }
// };

// // Функція для перевірки завершення діалогу
// const detectCompletion = (message: string) => {
//   const completionKeywords = ["thank you", "bye"];
//   if (completionKeywords.some((word) => message.toLowerCase().includes(word))) {
//     metrics.completedConversations++;
//   }
// };

// // Функція для перевірки утримання контексту
// const testContextRetention = (messages: string[]) => {
//   const contextKeywords = ["what's my name", "can you repeat"];
//   if (
//     messages.some((msg) =>
//       contextKeywords.some((word) => msg.toLowerCase().includes(word)),
//     )
//   ) {
//     metrics.contextRetentionScore++;
//   }
// };

// // Функція для збору даних про ресурси
// const collectResourceUsage = () => {
//   const cpuUsage = process.cpuUsage().system;
//   const memoryUsage = process.memoryUsage().heapUsed;

//   metrics.cpuUsage.push(cpuUsage);
//   metrics.memoryUsage.push(memoryUsage);
// };

// // Симуляція обробки запитів
// const processRequest = (
//   previousMessages: any[],
//   currentMessageContent: string,
//   responseTime: number,
// ) => {
//   metrics.requestCount++;
//   calculateAverageResponseTime(responseTime);
//   testContextRetention(previousMessages.map((msg) => msg.content));
//   detectCompletion(currentMessageContent);
//   collectResourceUsage();
// };

// // Тестові дані
// const testInputs = Array.from({ length: 100 }, (_, i) => `Test message ${i}`);

// // Симуляція роботи системи
// let totalResponseTime = 0;
// testInputs.forEach((input, index) => {
//   const responseTime = Math.floor(Math.random() * 10) + 1; // Випадковий час відповіді (1-10 мс)
//   totalResponseTime += responseTime;

//   const previousMessages = testInputs.slice(0, index).map((content) => ({
//     content,
//   }));

//   processRequest(previousMessages, input, responseTime);
// });

// // Підрахунок середнього використання ресурсів
// metrics.averageCpuUsage =
//   metrics.cpuUsage.reduce((acc, val) => acc + val, 0) / metrics.cpuUsage.length;
// metrics.averageMemoryUsage =
//   metrics.memoryUsage.reduce((acc, val) => acc + val, 0) /
//   metrics.memoryUsage.length;

// // Виведення результатів
// console.log("Final Metrics:", metrics);
