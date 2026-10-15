
import { useState } from "react";

function ChatInput({ onSend, disabled = false }) {
    const [input, setInput] = useState("");

    const handleSubmit = (event) => {
        event.preventDefault();

        const message = input.trim();

        if (!message || disabled) return;

        onSend(message);
        setInput("");
    };

    return (
        <form className="chat-input" onSubmit={handleSubmit}>
            <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask anything..."
                aria-label="Message"
                disabled={disabled}
            />

            <button
                type="submit"
                disabled={disabled || !input.trim()}
            >
                {disabled ? "Thinking..." : "Send"}
            </button>
        </form>
    );
}

export default ChatInput;
