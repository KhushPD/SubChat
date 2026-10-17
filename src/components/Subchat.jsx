import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const API_URL = "/api/chat";
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
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          table: ({ node: _node, ...props }) => (
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
  isClosing = false,
  onToggleCollapsed,
  onFocusMain = () => { },
  onClose,
}) {
  const messages = Array.isArray(messagesProp) ? messagesProp : [];
  const safeContext = Array.isArray(contextMessages) ? contextMessages : [];

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const pendingScrollPromptIdRef = useRef(null);

  // When writing a prompt, scroll to the prompt at the top so user stays at the start of the generated answer
  useEffect(() => {
    if (pendingScrollPromptIdRef.current) {
      const promptId = pendingScrollPromptIdRef.current;
      const el = document.getElementById(`subchat-msg-${promptId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        pendingScrollPromptIdRef.current = null;
      }
    }
  }, [messages.length]);

  const handleSend = async (event) => {
    event.preventDefault();

    const text = input.trim();
    if (!text || isLoading || typeof setMessages !== "function") return;

    const userMsgId = `${Date.now()}-user`;
    pendingScrollPromptIdRef.current = userMsgId;

    const updatedMessages = [...messages, { id: userMsgId, role: "user", content: text }];
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

  const handleHeaderClick = (event) => {
    // If collapsed and clicked outside button controls, expand the panel
    if (isCollapsed && !event.target.closest("button")) {
      onToggleCollapsed?.();
    }
  };

  return (
    <section
      className={`subchat-panel${isCollapsed ? " collapsed" : ""}${isClosing ? " is-closing" : ""}`}
      aria-label={`Subchat exploring ${concept}`}
    >
      <header
        className="subchat-header"
        onClick={handleHeaderClick}
        title={isCollapsed ? "Click to expand" : undefined}
      >
        <div className="subchat-heading">
          <span className="subchat-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </span>
          <div className="subchat-heading-copy">
            <div className="subchat-title">Subchat</div>
            <div className="subchat-concept" title={concept}>
              Exploring: {concept}
            </div>
          </div>
        </div>

        <div className="subchat-controls" onClick={(e) => e.stopPropagation()}>
          {!isCollapsed && (
            <button
              className="subchat-control-button focus-main"
              type="button"
              onClick={onFocusMain}
              aria-label="Hide Subchat panel"
              title="Hide Subchat panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 5 7 12l7 7M7 12h13" />
              </svg>
            </button>
          )}

          <button
            className="subchat-control-button toggle-collapse"
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand Subchat" : "Collapse Subchat"}
            title={isCollapsed ? "Expand Subchat" : "Collapse Subchat"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isCollapsed ? (
                <polyline points="6 9 12 15 18 9" />
              ) : (
                <polyline points="18 15 12 9 6 15" />
              )}
            </svg>
          </button>

          <button
            className="subchat-control-button close-arrow"
            type="button"
            onClick={onClose}
            aria-label="Close Subchat panel (→)"
            title="Close Subchat panel (→)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </header>

      {!isCollapsed && (
        <>
          <div className="subchat-context-trail" aria-label="Subchat context trail">
            <div className="subchat-context-rail" aria-hidden="true">
              <span className="subchat-context-node" />
              <span className="subchat-context-line" />
            </div>
            <div className="subchat-context-trail-copy">
              <span className="subchat-context-eyebrow">FROM MAIN CONVERSATION</span>
              <div className="subchat-context-concept-row">
                <span className="subchat-context-arrow" aria-hidden="true">↳</span>
                <span className="subchat-context-concept" title={concept}>{concept}</span>
              </div>
              {originalQuestion && (
                <p className="subchat-context-question" title={originalQuestion}>
                  {originalQuestion}
                </p>
              )}
            </div>
          </div>

          <details className="inherited-context">
            <summary>
              <span className="context-summary-leading">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 8v4l2.5 1.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>Original context</span>
              </span>
              <span className="context-summary-action">View</span>
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                    <path d="M12 3.5 14.4 9.6 20.5 12l-6.1 2.4L12 20.5l-2.4-6.1L3.5 12l6.1-2.4L12 3.5Z" />
                  </svg>
                </div>
                <p className="subchat-empty-title">Explore this idea</p>
                <p className="subchat-empty-copy">
                  Ask a follow-up about <strong>{concept}</strong> without losing your place in the main conversation.
                </p>
              </div>
            )}

            {messages.map((message, index) => {
              const msgId = message.id || `subchat-${index}`;
              return (
                <article
                  id={`subchat-msg-${msgId}`}
                  className={`subchat-message ${message.role}`}
                  key={msgId}
                >
                {message.role === "assistant" && (
                  <div className="subchat-message-label">
                    <span className="subchat-message-avatar">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3.5 14.4 9.6 20.5 12l-6.1 2.4L12 20.5l-2.4-6.1L3.5 12l6.1-2.4L12 3.5Z" />
                      </svg>
                    </span>
                    <span>SubChat</span>
                  </div>
                )}

                {message.role === "assistant" ? (
                  <FormattedResponse content={message.content} />
                ) : (
                  <div className="subchat-user-bubble">
                    {String(message.content || "")}
                  </div>
                )}
              </article>
            );
          })}

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

          <form className="subchat-input-form" onSubmit={handleSend}>
            <div className="subchat-input-container">
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
                className={`subchat-send-btn ${input.trim() ? "active" : ""}`}
                disabled={isLoading || !input.trim()}
                aria-label={isLoading ? "Generating response" : "Send message"}
                title="Send message"
              >
                {isLoading ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

export default Subchat;
