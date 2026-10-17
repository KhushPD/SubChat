import { useState, useRef, useEffect, useCallback } from "react";

function ChatInput({ onSend, disabled = false }) {
    const [input, setInput] = useState("");
    const [isMultiLine, setIsMultiLine] = useState(false);
    const textareaRef = useRef(null);

    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        const newHeight = Math.min(el.scrollHeight, 200);
        el.style.height = newHeight + "px";
        setIsMultiLine(newHeight > 46 || input.includes("\n"));
    }, [input]);

    useEffect(() => {
        autoResize();
    }, [input, autoResize]);

    const handleSubmit = (event) => {
        event?.preventDefault();

        const message = input.trim();
        if (!message || disabled) return;

        onSend(message);
        setInput("");
        setIsMultiLine(false);

        // Reset textarea height after sending
        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        });
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    };

    const hasText = input.trim().length > 0;

    return (
        <div className="input-dock-wrapper">
            <div className="input-dock">
                <form className="input-dock-form" onSubmit={handleSubmit}>
                    <div className={`input-container ${isMultiLine ? "multiline" : ""}`}>
                        <button
                            type="button"
                            className="input-attach-btn"
                            title="Attach file"
                            aria-label="Attach file"
                            tabIndex={-1}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message SubChat"
                            aria-label="Message"
                            disabled={disabled}
                            rows={1}
                        />

                        <div className="input-right-actions">
                            <button
                                type="submit"
                                className={`input-send-btn ${hasText ? "active" : ""} ${disabled ? "streaming" : ""}`}
                                disabled={disabled && !hasText ? true : false}
                                title={disabled ? "Stop generating" : "Send message"}
                                aria-label={disabled ? "Stop generating" : "Send message"}
                            >
                                {disabled ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M12 19V5" />
                                        <path d="m5 12 7-7 7 7" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            <div className="input-disclaimer">
                SubChat can make mistakes. Check important info.
            </div>
        </div>
    );
}

export default ChatInput;
