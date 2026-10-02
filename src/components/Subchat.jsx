import { useState } from "react";

function Subchat({
  concept,
  originalQuestion,
  sourceMessage,
  messages,
  setMessages,
  onClose
}) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input
    };

    const aiMessage = {
      id: Date.now() + 1,
      role: "assistant",
      content: `Here's a simple way to understand "${concept}": think of it as a concept that can be broken down into smaller ideas and examples. In a real version, the AI would use the surrounding conversation context to give you a relevant explanation.`
    };

    setMessages([
      ...messages,
      userMessage,
      aiMessage
    ]);

    setInput("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleSend();
    }
  };

  return (
    <aside className="subchat-panel">
      <div className="subchat-header">
        <div>
          <div className="subchat-title">
            Subchat
          </div>

          <div className="subchat-subtitle">
            Exploring selected text
          </div>
        </div>

        <button
          className="close-button"
          onClick={onClose}
          title="Close Subchat"
        >
          ×
        </button>
      </div>

      <div className="subchat-context">
        <div className="context-label">
          EXPLORING
        </div>

        <div className="context-concept">
          "{concept}"
        </div>

        <div className="context-section">
          <div className="context-heading">
            Original question
          </div>

          <p>
            {originalQuestion}
          </p>
        </div>

        <div className="context-section">
          <div className="context-heading">
            From the AI response
          </div>

          <p>
            {sourceMessage}
          </p>
        </div>
      </div>

      <div className="subchat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`subchat-message ${message.role}`}
          >
            <div className="message-label">
              {message.role === "user"
                ? "You"
                : "AI"}
            </div>

            <p>
              {message.content}
            </p>
          </div>
        ))}
      </div>

      <div className="subchat-input">
        <input
          type="text"
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder={`Ask about "${concept}"...`}
        />

        <button onClick={handleSend}>
          Send
        </button>
      </div>
    </aside>
  );
}

export default Subchat;