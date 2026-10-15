
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const API_URL = "http://localhost:3001/api/chat";
const MAX_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 1500;

function formatMarkdown(text = "") {
  return String(text)
    .replace(/\\([#*_|])/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`)
    .replace(/\\([`~])/g, "$1");
}

function FormattedResponse({ content }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          table: ({ node, ...props }) => (
            <div className="markdown-table-wrapper">
              <table {...props} />
            </div>
          ),
        }}
      >
        {formatMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}

function Subchat({
  concept = "Selected concept",
  originalQuestion = "",
  sourceMessage = "",
  contextMessages = [],
  messages: messagesProp = [],
  setMessages,
  isCollapsed = false,
  onToggleCollapsed,
  onClose,
}) {
  const messages = Array.isArray(messagesProp) ? messagesProp : [];
  const safeContext = Array.isArray(contextMessages) ? contextMessages : [];

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async (event) => {
    event.preventDefault();

    const text = input.trim();

    if (!text || isLoading || typeof setMessages !== "function") {
      return;
    }

    const updatedMessages = [
      ...messages,
      { role: "user", content: text },
    ];

    setMessages(updatedMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const conversation = updatedMessages
        .slice(-MAX_MESSAGES)
        .map(({ role, content }) => ({
          role,
          content: String(content || "").slice(0, MAX_MESSAGE_LENGTH),
        }));

      const limitedContext = safeContext
        .slice(-3)
        .map(({ role, content }) => ({
          role,
          content: String(content || "").slice(0, MAX_MESSAGE_LENGTH),
        }));

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "subchat",
          concept: String(concept).slice(0, 200),
          originalQuestion: String(originalQuestion).slice(0, 500),
          sourceMessage: String(sourceMessage).slice(0, 2500),
          contextMessages: limitedContext,
          conversation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.message;

        throw new Error(message || `Request failed (${response.status}).`);
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The AI returned an empty response.");
      }

      // Pass an actual array to the parent, never a function.
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      console.error("Subchat request failed:", err);
      setError(err.message || "Sorry, I couldn't generate a response.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="subchat-panel">
      <div className="subchat-header">
        <div className="subchat-heading">
          <span className="subchat-icon" aria-hidden="true">↗</span>
          <div>
            <div className="subchat-title">Subchat</div>
            <div className="subchat-concept">Exploring: {concept}</div>
          </div>
        </div>

        <div className="subchat-controls">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand Subchat" : "Collapse Subchat"}
          >
            {isCollapsed ? "＋" : "−"}
          </button>
          <button type="button" onClick={onClose} aria-label="Close Subchat">
            ×
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <details className="inherited-context">
            <summary>View original context</summary>

            {originalQuestion && (
              <div className="context-block">
                <strong>Original question</strong>
                <p>{originalQuestion}</p>
              </div>
            )}

            {sourceMessage && (
              <div className="context-block">
                <strong>Selected response</strong>
                <FormattedResponse content={sourceMessage} />
              </div>
            )}

            {safeContext.length > 0 && (
              <div className="context-block">
                <strong>Earlier conversation</strong>
                {safeContext.slice(-3).map((message, index) => (
                  <div className="context-message" key={`${message.role}-${index}`}>
                    <strong>{message.role === "user" ? "You" : "AI"}</strong>
                    <p>{String(message.content || "")}</p>
                  </div>
                ))}
              </div>
            )}
          </details>

          <div className="subchat-messages">
            {messages.map((message, index) => (
              <div
                className={`subchat-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                <div className="subchat-message-label">
                  {message.role === "user" ? "You" : "AI"}
                </div>

                {message.role === "assistant" ? (
                  <FormattedResponse content={message.content} />
                ) : (
                  <div className="subchat-user-content">
                    {String(message.content || "")}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="subchat-thinking">AI is thinking...</div>
            )}

            {error && (
              <div className="subchat-error" role="alert">
                <p>{error}</p>
                <button type="button" onClick={() => setError("")}>
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <form className="subchat-input" onSubmit={handleSend}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Ask about ${concept}...`}
              aria-label="Ask a Subchat question"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? "Thinking..." : "Send"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

export default Subchat;
