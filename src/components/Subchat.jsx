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

function ContextSection({ label, children }) {
  return (
    <div className="context-block">
      <div className="context-section-label">{label}</div>
      {children}
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
    if (!text || isLoading || typeof setMessages !== "function") return;

    const updatedMessages = [...messages, { role: "user", content: text }];
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

      const limitedContext = safeContext.slice(-3).map(({ role, content }) => ({
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
          typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message || `Request failed (${response.status}).`);
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The AI returned an empty response.");
      }

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
    <section
      className={`subchat-panel${isCollapsed ? " collapsed" : ""}`}
      aria-label={`Subchat exploring ${concept}`}
    >
      <header className="subchat-header">
        <div className="subchat-heading">
          <span className="subchat-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 17 17 7M8 7h9v9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="subchat-heading-copy">
            <div className="subchat-title">Subchat</div>
            <div className="subchat-concept" title={concept}>
              Exploring: {concept}
            </div>
          </div>
        </div>

        <div className="subchat-controls">
          <button
            className="subchat-control-button"
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand Subchat" : "Collapse Subchat"}
            title={isCollapsed ? "Expand Subchat" : "Collapse Subchat"}
          >
            {isCollapsed ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            className="subchat-control-button close"
            type="button"
            onClick={onClose}
            aria-label="Close Subchat"
            title="Close Subchat"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {!isCollapsed && (
        <>
          <details className="inherited-context">
            <summary>
              <span className="context-summary-leading">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 8v4l2.5 1.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Original context</span>
              </span>
              <span className="context-summary-action">View context</span>
            </summary>

            <div className="context-details-content">
              {originalQuestion && (
                <ContextSection label="ORIGINAL QUESTION">
                  <p>{originalQuestion}</p>
                </ContextSection>
              )}

              {sourceMessage && (
                <ContextSection label="SELECTED RESPONSE">
                  <FormattedResponse content={sourceMessage} />
                </ContextSection>
              )}

              {safeContext.length > 0 && (
                <ContextSection label="EARLIER CONVERSATION">
                  {safeContext.slice(-3).map((message, index) => (
                    <div
                      className="context-message"
                      key={`${message.role}-${index}`}
                    >
                      <span className="context-speaker">
                        {message.role === "user" ? "You" : "AI"}
                      </span>
                      <p>{String(message.content || "")}</p>
                    </div>
                  ))}
                </ContextSection>
              )}
            </div>
          </details>

          <div className="subchat-messages" aria-live="polite">
            {messages.length === 0 && !isLoading && (
              <div className="subchat-empty-state">
                <div className="subchat-empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3.5 14.4 9.6 20.5 12l-6.1 2.4L12 20.5l-2.4-6.1L3.5 12l6.1-2.4L12 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="subchat-empty-title">Explore this idea</p>
                <p className="subchat-empty-copy">
                  Ask a follow-up about <strong>{concept}</strong> without losing your place in the main conversation.
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <article
                className={`subchat-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                <div className="subchat-message-label">
                  <span className={`message-avatar ${message.role}`}>
                    {message.role === "user" ? "Y" : "✳"}
                  </span>
                  <span>{message.role === "user" ? "You" : "Subchat AI"}</span>
                </div>

                {message.role === "assistant" ? (
                  <FormattedResponse content={message.content} />
                ) : (
                  <div className="subchat-user-content">
                    {String(message.content || "")}
                  </div>
                )}
              </article>
            ))}

            {isLoading && (
              <div className="subchat-thinking" role="status">
                <span className="thinking-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>Thinking through this with you…</span>
              </div>
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
              placeholder={`Ask about ${concept}…`}
              aria-label="Ask a Subchat question"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label={isLoading ? "Generating response" : "Send message"}
            >
              {isLoading ? (
                <span className="send-loading" aria-hidden="true">…</span>
              ) : (
                <>
                  <span>Send</span>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 12 20 4l-5.5 16-2.8-6.2L4 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="m11.7 13.8 4.1-4.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

export default Subchat;
