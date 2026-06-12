// ---------------------------------------------------------------------------
// Backend Message Send
// ---------------------------------------------------------------------------
// Handles sending prompts to the active backend and managing the send state.
// ---------------------------------------------------------------------------

import { ref, type Ref } from "vue";
import { getActiveBackendAdapter } from "../backends/registry";

export type MessageSendOptions = {
  selectedSessionId: Ref<string>;
  activeDirectory: Ref<string>;
  isSending: Ref<boolean>;
  agent: Ref<string>;
  modelId: Ref<string>;
  providerId: Ref<string>;
  variant: Ref<string>;
  toErrorMessage: (error: unknown) => string;
  onSendError?: (message: string) => void;
};

export function useBackendMessageSend(options: MessageSendOptions) {
  const sendError = ref<string | null>(null);

  async function sendPrompt(text: string): Promise<boolean> {
    const sessionId = options.selectedSessionId.value;
    if (!sessionId || !text.trim() || options.isSending.value) return false;

    options.isSending.value = true;
    sendError.value = null;

    try {
      const adapter = getActiveBackendAdapter();
      if (!adapter.sendPromptAsync) {
        throw new Error("Backend does not support sending prompts");
      }

      await adapter.sendPromptAsync(sessionId, {
        directory: options.activeDirectory.value,
        agent: options.agent.value || "code",
        model: {
          providerID: options.providerId.value || undefined,
          modelID: options.modelId.value,
        },
        variant: options.variant.value || undefined,
        parts: [{ type: "text", text }],
      });

      return true;
    } catch (error) {
      sendError.value = options.toErrorMessage(error);
      options.onSendError?.(sendError.value);
      return false;
    } finally {
      options.isSending.value = false;
    }
  }

  return {
    sendError,
    sendPrompt,
  };
}
