"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import type { SimulationState, TwinInputs, ActiveTreatment } from "@/lib/twin-types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIChatBoxProps {
  state: SimulationState;
  inputs: TwinInputs;
  day: number;
  activeTreatments: ActiveTreatment[];
  overallHealth: number;
}

export default function AIChatBox({
  state,
  inputs,
  day,
  activeTreatments,
  overallHealth,
}: AIChatBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when opening
  useEffect(() => {
    if (isOpen) setHasUnread(false);
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          simulationContext: {
            state,
            inputs,
            day,
            treatments: activeTreatments,
            overallHealth,
          },
        }),
      });

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.message || data.error || "I'm having trouble responding. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If chat is closed, show notification dot
      if (!isOpen) setHasUnread(true);
    } catch {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, state, inputs, day, activeTreatments, overallHealth, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ai-chatbox-button"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageCircle className="h-5 w-5" />
            {hasUnread && <span className="ai-chatbox-notification" />}
          </>
        )}
      </button>

      {/* Chat panel */}
      <div className={`ai-chatbox-panel ${isOpen ? "ai-chatbox-panel--open" : ""}`}>
        {/* Header */}
        <div className="ai-chatbox-header">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "var(--gradient-cyber)" }}>
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">BioTwin AI</h3>
              <p className="text-[10px] text-muted-foreground">Context-aware health advisor</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages area */}
        <div className="ai-chatbox-messages scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--gradient-cyber)" }}>
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Ask BioTwin AI</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  I know your health simulation data and can give personalized advice.
                </p>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {[
                  "What should I focus on improving?",
                  "Why is my fatigue so high?",
                  "How can I protect my heart?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md mt-0.5" style={{ background: "var(--gradient-cyber)" }}>
                  <Bot className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 bg-secondary/60 text-foreground"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary mt-0.5">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: "var(--gradient-cyber)" }}>
                <Bot className="h-3 w-3 text-primary-foreground" />
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/60 px-3 py-2">
                <div className="flex gap-1">
                  <span className="ai-typing-dot" style={{ animationDelay: "0ms" }} />
                  <span className="ai-typing-dot" style={{ animationDelay: "150ms" }} />
                  <span className="ai-typing-dot" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="ai-chatbox-input">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your health..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all disabled:opacity-30 enabled:hover:bg-primary enabled:hover:text-primary-foreground"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
