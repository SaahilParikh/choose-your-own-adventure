/**
 * Types shared across LangGraph nodes.
 *
 * The `Invokable` interface is a minimal subset of LangChain's `BaseChatModel`
 * shape. Nodes accept this interface instead of `{ invoke: Function }` so that
 * (a) test mocks and (b) real `ChatBedrockConverse` instances both type-check.
 *
 * Input type matches LangChain's `BaseLanguageModelInput` so that passing a
 * `ChatBedrockConverse` (or any LangChain chat model) satisfies the interface.
 * Output type is a structural subset — LangChain's `AIMessageChunk` has
 * `content` and `usage_metadata`, which is all the nodes consume.
 */

import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";

/** Token usage metadata returned by LangChain-compatible providers. */
export interface LLMTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
}

/** Response shape returned by `invoke()` for the models used in this project. */
export interface LLMResponse {
  /**
   * Content is typed loosely to match LangChain's runtime shape, which can return
   * either a plain string or structured content blocks. Node code normalizes this.
   */
  content: string | unknown;
  usage_metadata?: LLMTokenUsage;
}

/**
 * Minimal interface for an LLM that can be `.invoke()`-d with LangChain-style
 * message input. Satisfied by LangChain's chat models and by test mocks.
 */
export interface Invokable {
  invoke(input: BaseLanguageModelInput): Promise<LLMResponse>;
}
