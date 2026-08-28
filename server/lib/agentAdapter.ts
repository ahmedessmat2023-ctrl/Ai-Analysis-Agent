/**
 * Agent Adapter Interface — abstract layer for multiple LLM providers
 * Supports: Gemini (default), Ollama, OpenCodeInterpreter (Zen), NVIDIA NIM
 */

export interface InteractionOptions {
  prompt: string;
  agentName?: string;
  environmentId?: string;
  previousInteractionId?: string;
  stream?: boolean;
  inlineSources?: Array<
    | { type: "inline"; content: string; target: string }
    | { type: "gcs"; source: string; target: string }
    | { type: "repository"; source: string; target: string }
  >;
  gcsToken?: string;
  signal?: AbortSignal;
}

export interface AgentEvent {
  type:
    | "thinking"
    | "text"
    | "tool_call"
    | "tool_result"
    | "interaction"
    | "complete"
    | "error"
    | "done";
  text?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  result?: string;
  interaction?: Record<string, unknown>;
  message?: string;
}

export interface AgentProvider {
  createInteraction(opts: InteractionOptions): Promise<Response>;
  streamInteraction(response: Response): AsyncGenerator<AgentEvent>;
  getProviderName(): string;
}

export type ProviderType = "gemini" | "ollama" | "zen" | "nim";

export const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export function getProvider(): AgentProvider {
  const providerType = (process.env.AGENT_PROVIDER || "gemini").toLowerCase().trim() as ProviderType;
  return createProvider(providerType);
}

export function createProvider(type: ProviderType): AgentProvider {
  console.log(`[Agent] Initializing provider: ${type}`);

  switch (type) {
    case "ollama":
      return new OllamaProvider();
    case "zen":
      return new ZenProvider();
    case "nim":
      return new NIMProvider();
    case "gemini":
    default:
      return new GeminiProvider();
  }
}

function resolveChatCompletionsUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, "");
  if (clean.endsWith("/chat/completions")) {
    return clean;
  }
  if (clean.endsWith("/v1")) {
    return `${clean}/chat/completions`;
  }
  return `${clean}/v1/chat/completions`;
}

function resolveOllamaUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, "");
  if (clean.endsWith("/api/generate")) {
    return clean;
  }
  if (clean.endsWith("/api")) {
    return `${clean}/generate`;
  }
  return `${clean}/api/generate`;
}

// ════════════════════════════════════════════════════════════════
// GEMINI (Original)
// ════════════════════════════════════════════════════════════════

export class GeminiProvider implements AgentProvider {
  private apiBaseUrl = API_BASE_URL;

  getProviderName(): string {
    return "Gemini";
  }

  async createInteraction(opts: InteractionOptions): Promise<Response> {
    const agentName = opts.agentName ?? "antigravity-preview-05-2026";

    const payload: Record<string, unknown> = {
      agent: agentName,
      input: [{ type: "text", text: opts.prompt }],
      stream: true,
    };

    if (opts.environmentId) {
      payload.environment = { env_id: opts.environmentId };
    } else {
      const allowlist: any[] = [
        {
          domain: "generativelanguage.googleapis.com",
          transform: { "x-goog-api-key": process.env.GEMINI_API_KEY },
        },
      ];

      if (opts.gcsToken) {
        allowlist.push({
          domain: "storage.googleapis.com",
          transform: { Authorization: `Bearer ${opts.gcsToken}` },
        });
      }

      allowlist.push({ domain: "*" });

      payload.environment = {
        type: "remote",
        sources: opts.inlineSources ?? [],
        network: { allowlist },
      };
    }

    if (opts.previousInteractionId) {
      payload.previous_interaction_id = opts.previousInteractionId;
    }

    const response = await fetch(`${this.apiBaseUrl}/interactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY || "",
        "x-server-timeout": "600",
        "Api-Revision": "2026-05-20",
        "x-goog-api-client": "applet-ai-data-analyst/1.0.0",
      },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });

    return response;
  }

  async *streamInteraction(response: Response): AsyncGenerator<AgentEvent> {
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", message: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const event = this.parseSseLine(line);
          if (!event) continue;
          yield event;
          if (event.type === "done") return;
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        const event = this.parseSseLine(buffer);
        if (event) yield event;
      }
    } catch (err: any) {
      yield { type: "error", message: `Stream error: ${err.message}` };
    } finally {
      reader.releaseLock();
    }
  }

  private parseSseLine(line: string): AgentEvent | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return null;

    const dataStr = trimmed.slice(5).trimStart();
    if (dataStr === "[DONE]") return { type: "done" };

    try {
      const parsed = JSON.parse(dataStr);
      return this.parseAgentEvent(parsed);
    } catch {
      return null;
    }
  }

  private parseAgentEvent(event: Record<string, unknown>): AgentEvent | null {
    const eventType = event.event_type as string | undefined;

    if (eventType === "interaction.created") {
      return {
        type: "interaction",
        interaction: (event.interaction as Record<string, unknown>) ?? event,
      };
    }

    if (eventType === "step.delta") {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (!delta) return null;

      // Tool results
      const resultVal = delta.result ?? delta.response;
      if (resultVal !== undefined && resultVal !== null) {
        return {
          type: "tool_result",
          name: delta.name as string | undefined,
          result: String(resultVal),
        };
      }

      // Tool calls
      let args =
        (delta.arguments as Record<string, unknown>) ||
        ((delta.call as any)?.arguments as Record<string, unknown>);
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch {}
      }

      if (delta.name || args) {
        return {
          type: "tool_call",
          name: (delta.name as string) || "code_execution",
          arguments: args ?? {},
        };
      }

      // Text / thinking
      let text = "";
      if (typeof delta.text === "string") text = delta.text;
      else if (typeof delta.thought === "string") text = delta.thought;

      if (text) {
        return { type: "text", text };
      }
    }

    if (eventType === "interaction.completed") {
      return {
        type: "complete",
        interaction: (event.interaction as Record<string, unknown>) ?? {},
      };
    }

    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// OLLAMA
// ════════════════════════════════════════════════════════════════

export class OllamaProvider implements AgentProvider {
  private get apiBaseUrl(): string {
    return process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  }
  private get model(): string {
    return process.env.OLLAMA_MODEL || "mistral";
  }

  getProviderName(): string {
    return "Ollama";
  }

  async createInteraction(opts: InteractionOptions): Promise<Response> {
    // Prepare file context from inline sources
    let fileContext = "";
    if (opts.inlineSources && opts.inlineSources.length > 0) {
      for (const source of opts.inlineSources) {
        if (source.type === "inline") {
          fileContext += `\n\n--- File: ${source.target} ---\n${source.content}`;
        }
      }
    }

    // Inject file context into prompt
    const enhancedPrompt = fileContext
      ? `${opts.prompt}\n\n[Context Files]:${fileContext}`
      : opts.prompt;

    const payload = {
      model: this.model,
      prompt: enhancedPrompt,
      stream: true,
      system: this.getSystemPrompt(),
    };

    const targetUrl = resolveOllamaUrl(this.apiBaseUrl);
    console.log(`[Ollama] POST ${targetUrl} (model: ${this.model})`);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });

    return response;
  }

  async *streamInteraction(response: Response): AsyncGenerator<AgentEvent> {
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", message: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);

            if (chunk.response) {
              // Check for code execution patterns
              if (
                chunk.response.includes("```python") ||
                chunk.response.includes("```bash")
              ) {
                const codeMatch = chunk.response.match(
                  /```(?:python|bash)\n([\s\S]*?)```/,
                );
                if (codeMatch) {
                  yield {
                    type: "tool_call",
                    name: "code_execution",
                    arguments: {
                      code: codeMatch[1],
                      language: chunk.response.includes("python")
                        ? "python"
                        : "bash",
                    },
                  };
                }
              }

              // Regular text output
              yield { type: "text", text: chunk.response };
            }

            if (chunk.done) {
              yield { type: "complete", interaction: {} };
              return;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err: any) {
      yield { type: "error", message: `Stream error: ${err.message}` };
    } finally {
      reader.releaseLock();
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert data analyst working with CSV files and Python.
Your task is to analyze datasets by writing Python code.
When you need to run code, wrap it in \`\`\`python ... \`\`\` blocks.
Always provide clear explanations of your findings.
Output final results in JSON format when generating reports.`;
  }
}

// ════════════════════════════════════════════════════════════════
// OPENCODE INTERPRETER (ZEN)
// ════════════════════════════════════════════════════════════════

export class ZenProvider implements AgentProvider {
  private get apiBaseUrl(): string {
    return process.env.ZEN_BASE_URL || "http://localhost:8000";
  }
  private get apiKey(): string {
    return process.env.ZEN_API_KEY || "";
  }
  private get model(): string {
    return process.env.ZEN_MODEL || "big-pickle";
  }

  getProviderName(): string {
    return "OpenCodeInterpreter (Zen)";
  }

  async createInteraction(opts: InteractionOptions): Promise<Response> {
    // Prepare file context
    let fileContext = "";
    if (opts.inlineSources && opts.inlineSources.length > 0) {
      for (const source of opts.inlineSources) {
        if (source.type === "inline") {
          fileContext += `\n\n--- File: ${source.target} ---\n${source.content}`;
        }
      }
    }

    const enhancedPrompt = fileContext
      ? `${opts.prompt}\n\n[Context Files]:${fileContext}`
      : opts.prompt;

    // Zen uses a conversation-based API
    const payload = {
      model: this.model,
      messages: [
        {
          role: "system",
          content: this.getSystemPrompt(),
        },
        {
          role: "user",
          content: enhancedPrompt,
        },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    };

    const targetUrl = resolveChatCompletionsUrl(this.apiBaseUrl);
    console.log(`[Zen] POST ${targetUrl} (model: ${this.model})`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: opts.signal,
    });

    return response;
  }

  async *streamInteraction(response: Response): AsyncGenerator<AgentEvent> {
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", message: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data:")) continue;

          const dataStr = line.slice(5).trim();
          if (dataStr === "[DONE]") {
            yield { type: "complete", interaction: {} };
            return;
          }

          try {
            const chunk = JSON.parse(dataStr);
            const content = chunk.choices?.[0]?.delta?.content || "";

            if (content) {
              fullResponse += content;
              yield { type: "text", text: content };

              // Detect code execution
              if (
                content.includes("```python") ||
                content.includes("```bash") ||
                content.includes("```shell")
              ) {
                const codeMatch = fullResponse.match(
                  /```(?:python|bash|shell)\n([\s\S]*?)```/,
                );
                if (codeMatch) {
                  yield {
                    type: "tool_call",
                    name: "code_execution",
                    arguments: {
                      code: codeMatch[1],
                      language: "python",
                    },
                  };
                }
              }
            }
          } catch {
            // Skip malformed SSE frames
          }
        }
      }
    } catch (err: any) {
      yield { type: "error", message: `Stream error: ${err.message}` };
    } finally {
      reader.releaseLock();
    }
  }

  private getSystemPrompt(): string {
    return `You are OpenCodeInterpreter, an expert Python code interpreter and data analyst.
Your capabilities include:
- Writing and executing Python code
- Data analysis with Pandas, NumPy
- Creating visualizations with Matplotlib
- Statistical analysis and modeling
When writing code, explain your approach first, then provide the complete code in \`\`\`python blocks.
Always validate data, handle edge cases, and provide clear insights.`;
  }
}

// ════════════════════════════════════════════════════════════════
// NVIDIA NIM
// ════════════════════════════════════════════════════════════════

export class NIMProvider implements AgentProvider {
  private get apiBaseUrl(): string {
    return process.env.NIM_BASE_URL || "http://localhost:8000";
  }
  private get apiKey(): string {
    return process.env.NIM_API_KEY || "";
  }
  private get model(): string {
    return process.env.NIM_MODEL || "meta/llama-3.1-70b-instruct";
  }

  getProviderName(): string {
    return "NVIDIA NIM";
  }

  async createInteraction(opts: InteractionOptions): Promise<Response> {
    // Prepare file context
    let fileContext = "";
    if (opts.inlineSources && opts.inlineSources.length > 0) {
      for (const source of opts.inlineSources) {
        if (source.type === "inline") {
          fileContext += `\n\n--- File: ${source.target} ---\n${source.content}`;
        }
      }
    }

    const enhancedPrompt = fileContext
      ? `${opts.prompt}\n\n[Context Files]:${fileContext}`
      : opts.prompt;

    const payload = {
      model: this.model,
      messages: [
        {
          role: "system",
          content: this.getSystemPrompt(),
        },
        {
          role: "user",
          content: enhancedPrompt,
        },
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.9,
    };

    const targetUrl = resolveChatCompletionsUrl(this.apiBaseUrl);
    console.log(`[NIM] POST ${targetUrl} (model: ${this.model})`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: opts.signal,
    });

    return response;
  }

  async *streamInteraction(response: Response): AsyncGenerator<AgentEvent> {
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", message: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data:")) continue;

          const dataStr = line.slice(5).trim();
          if (dataStr === "[DONE]") {
            yield { type: "complete", interaction: {} };
            return;
          }

          try {
            const chunk = JSON.parse(dataStr);
            const content = chunk.choices?.[0]?.delta?.content || "";

            if (content) {
              fullResponse += content;
              yield { type: "text", text: content };

              // Detect structured tool calls or code blocks
              if (
                content.includes("<function_calls>") ||
                content.includes("```python") ||
                content.includes("```bash")
              ) {
                const codeMatch = fullResponse.match(
                  /```(?:python|bash)\n([\s\S]*?)```/,
                );
                const funcMatch = fullResponse.match(
                  /<function_calls>([\s\S]*?)<\/function_calls>/,
                );

                if (codeMatch) {
                  yield {
                    type: "tool_call",
                    name: "code_execution",
                    arguments: { code: codeMatch[1] },
                  };
                } else if (funcMatch) {
                  try {
                    const func = JSON.parse(funcMatch[1]);
                    yield {
                      type: "tool_call",
                      name: func.name || "unknown",
                      arguments: func.arguments || {},
                    };
                  } catch {}
                }
              }
            }
          } catch {
            // Skip malformed SSE frames
          }
        }
      }
    } catch (err: any) {
      yield { type: "error", message: `Stream error: ${err.message}` };
    } finally {
      reader.releaseLock();
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert AI data analyst powered by NVIDIA NIM.
Your role is to analyze datasets and provide comprehensive insights using Python.
Capabilities:
- Execute Python code for data analysis (Pandas, NumPy, scikit-learn)
- Generate visualizations (Matplotlib, Seaborn)
- Perform statistical analysis and machine learning
- Create structured reports with findings and recommendations

When writing code:
1. Explain your approach first
2. Write complete, executable Python code in \`\`\`python blocks
3. Validate data and handle edge cases
4. Provide clear, actionable insights
5. Format final outputs as structured JSON

Always prioritize accuracy, robustness, and clarity.`;
  }
}
