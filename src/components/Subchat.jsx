
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

function formatMarkdown(text = "") {
  return text
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
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, strict: "ignore" }]
        ]}
        components={{
          table: ({ children }) => (
            <div className="markdown-table-wrapper">
              <table>{children}</table>
            </div>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          )
        }}
      >
        {formatMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}

function Subchat({
  concept,
  originalQuestion,
  sourceMessage,
  contextMessages = [],
  messages,
  setMessages,
  isCollapsed,
  onToggleCollapsed,
  onClose
}) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input.trim()
    };

    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3001/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            concept,
            originalQuestion,
            sourceMessage,
            contextMessages,
            conversation: updatedMessages
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
          data.error ||
          `Server error: ${response.status}`
        );
      }

      if (!data.reply) {
        throw new Error("The API returned an empty response.");
      }

      setMessages([
        ...updatedMessages,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: data.reply
        }
      ]);
    } catch (error) {
      console.error("Subchat request failed:", error);

      setMessages([
        ...updatedMessages,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: `Connection error: ${error.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <aside className={`subchat-panel ${isCollapsed ? "collapsed" : ""}`}>
      <div className="subchat-header">
        <button
          className="subchat-heading-button"
          onClick={onToggleCollapsed}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Expand Subchat" : "Collapse Subchat"}
        >
          <span className="collapse-indicator">
            {isCollapsed ? "▸" : "▾"}
          </span>

          <span className="subchat-heading-text">
            <span className="subchat-title">Subchat</span>
            <span className="subchat-subtitle">
              {concept.length > 35 ? `${concept.slice(0, 35)}…` : concept}
            </span>
          </span>
        </button>

        <div className="subchat-header-actions">
          <button
            className="collapse-button"
            onClick={onToggleCollapsed}
            title={isCollapsed ? "Expand Subchat" : "Collapse Subchat"}
            aria-label={isCollapsed ? "Expand Subchat" : "Collapse Subchat"}
          >
            {isCollapsed ? "□" : "−"}
          </button>

          <button
            className="close-button"
            onClick={onClose}
            title="Close Subchat"
            aria-label="Close Subchat"
          >
            ×
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="subchat-context">
            <div className="context-label">EXPLORING</div>
            <div className="context-concept">"{concept}"</div>

            <details className="inherited-context" open>
              <summary>Relevant conversation context</summary>

              <div className="inherited-context-messages">
                {contextMessages.length > 0 ? (
                  contextMessages.map((message, index) => (
                    <div
                      key={`${index}-${message.role}`}
                      className="inherited-context-message"
                    >
                      <span className="context-heading">
                        {message.role === "user" ? "You" : "AI"}
                      </span>
                      <p>{message.content}</p>
                    </div>
                  ))
                ) : (
                  <p>{sourceMessage}</p>
                )}
              </div>
            </details>

            <div className="context-section">
              <div className="context-heading">Relevant user question</div>
              <p>{originalQuestion || "No earlier question available."}</p>
            </div>
          </div>

          <div className="subchat-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`subchat-message ${message.role}`}
              >
                <div className="message-label">
                  {message.role === "user" ? "You" : "AI"}
                </div>

                {message.role === "assistant" &&
                  !message.content.startsWith("Connection error:") ? (
                  <FormattedResponse content={message.content} />
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="subchat-message assistant">
                <div className="message-label">AI</div>
                <p>Thinking...</p>
              </div>
            )}
          </div>

          <div className="subchat-input">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={`Ask about "${concept}"...`}
            />

            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? "..." : "Send"}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

export default Subchat;
