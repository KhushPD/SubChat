
import { useEffect, useState } from "react";
import Message from "./Message";
import ChatInput from "./ChatInput";
import Subchat from "./Subchat";

const MESSAGES_STORAGE_KEY = "subchat-main-messages";
const SUBCHATS_STORAGE_KEY = "subchat-saved-conversations";

function loadFromStorage(key, fallback, validator) {
    try {
        const saved = localStorage.getItem(key);

        if (!saved) return fallback;

        const parsed = JSON.parse(saved);

        return validator(parsed) ? parsed : fallback;
    } catch (error) {
        console.error(`Could not restore ${key}:`, error);
        return fallback;
    }
}

function isValidMessages(value) {
    return (
        Array.isArray(value) &&
        value.every(
            (message) =>
                message &&
                typeof message.role === "string" &&
                typeof message.content === "string"
        )
    );
}

function loadSavedMessages() {
    return loadFromStorage(
        MESSAGES_STORAGE_KEY,
        [],
        isValidMessages
    );
}

function loadSavedSubchats() {
    const saved = loadFromStorage(
        SUBCHATS_STORAGE_KEY,
        [],
        Array.isArray
    );

    return saved
        .filter(
            (subchat) =>
                subchat &&
                subchat.id !== undefined &&
                typeof subchat.concept === "string" &&
                Array.isArray(subchat.messages)
        )
        .map((subchat) => ({
            ...subchat,
            isCollapsed: Boolean(subchat.isCollapsed),
            contextMessages: Array.isArray(subchat.contextMessages)
                ? subchat.contextMessages
                : [],
            messages: isValidMessages(subchat.messages)
                ? subchat.messages
                : [],
        }));
}

function Chat() {
    const [messages, setMessages] = useState(loadSavedMessages);
    const [subchats, setSubchats] = useState(loadSavedSubchats);
    const [pendingSelection, setPendingSelection] = useState(null);
    const [isSending, setIsSending] = useState(false);

    // Save the main conversation whenever it changes.
    useEffect(() => {
        try {
            localStorage.setItem(
                MESSAGES_STORAGE_KEY,
                JSON.stringify(messages)
            );
        } catch (error) {
            console.error("Could not save main conversation:", error);
        }
    }, [messages]);

    // Save Subchat conversations, including their messages and collapsed state.
    useEffect(() => {
        try {
            localStorage.setItem(
                SUBCHATS_STORAGE_KEY,
                JSON.stringify(subchats)
            );
        } catch (error) {
            console.error("Could not save Subchats:", error);
        }
    }, [subchats]);

    // Dismiss the selection popup on scrolling or Escape.
    useEffect(() => {
        const dismissSelection = (event) => {
            if (
                event.type === "scroll" ||
                (event.type === "keydown" && event.key === "Escape")
            ) {
                setPendingSelection(null);
            }
        };

        window.addEventListener("scroll", dismissSelection, true);
        window.addEventListener("keydown", dismissSelection);

        return () => {
            window.removeEventListener("scroll", dismissSelection, true);
            window.removeEventListener("keydown", dismissSelection);
        };
    }, []);

    const handleMainSend = async (text) => {
        if (isSending || !text.trim()) return;

        const userMessage = {
            id: `${Date.now()}-user`,
            role: "user",
            content: text.trim(),
        };

        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setPendingSelection(null);
        setIsSending(true);

        try {
            const response = await fetch("http://localhost:3001/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    mode: "main",
                    conversation: updatedMessages.map(({ role, content }) => ({
                        role,
                        content,
                    })),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage =
                    typeof data.error === "string"
                        ? data.error
                        : data.error?.message || data.details;

                throw new Error(errorMessage || "The request failed.");
            }

            if (typeof data.reply !== "string" || !data.reply.trim()) {
                throw new Error("The AI returned an empty response.");
            }

            setMessages((previous) => [
                ...previous,
                {
                    id: `${Date.now()}-assistant`,
                    role: "assistant",
                    content: data.reply,
                },
            ]);
        } catch (error) {
            console.error("Main chat error:", error);

            setMessages((previous) => [
                ...previous,
                {
                    id: `${Date.now()}-error`,
                    role: "assistant",
                    content: `Sorry, I couldn't generate a response. ${error.message}`,
                },
            ]);
        } finally {
            setIsSending(false);
        }
    };

    const handleTextSelect = ({
        text,
        sourceMessage,
        sourceMessageId,
        position,
    }) => {
        if (!text || !position) return;

        setPendingSelection({
            text,
            sourceMessage,
            sourceMessageId,
            position,
        });
    };

    const openSubchat = () => {
        if (!pendingSelection) return;

        const sourceIndex = messages.findIndex(
            (message) => message.id === pendingSelection.sourceMessageId
        );

        if (sourceIndex < 0) {
            setPendingSelection(null);
            return;
        }

        const contextMessages = messages
            .slice(Math.max(0, sourceIndex - 5), sourceIndex + 1)
            .map(({ role, content }) => ({ role, content }));

        const precedingUserMessages = messages
            .slice(0, sourceIndex)
            .filter((message) => message.role === "user");

        const timestamp = Date.now();

        const newSubchat = {
            id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            concept: pendingSelection.text,
            sourceMessage: pendingSelection.sourceMessage,
            sourceMessageId: pendingSelection.sourceMessageId,
            originalQuestion:
                precedingUserMessages.length > 0
                    ? precedingUserMessages[precedingUserMessages.length - 1].content
                    : "",
            contextMessages,
            isCollapsed: false,
            messages: [
                {
                    id: `initial-${timestamp}`,
                    role: "assistant",
                    content: `Let's explore "${pendingSelection.text}" in more detail. What would you like to understand about it?`,
                },
            ],
        };

        setSubchats((previous) => [...previous, newSubchat]);
        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const closeSubchat = (id) => {
        setSubchats((previous) =>
            previous.filter((subchat) => subchat.id !== id)
        );
    };

    const updateSubchatMessages = (id, newMessages) => {
        if (!Array.isArray(newMessages)) return;

        setSubchats((previous) =>
            previous.map((subchat) =>
                subchat.id === id
                    ? { ...subchat, messages: newMessages }
                    : subchat
            )
        );
    };

    const toggleSubchatCollapsed = (id) => {
        setSubchats((previous) =>
            previous.map((subchat) =>
                subchat.id === id
                    ? { ...subchat, isCollapsed: !subchat.isCollapsed }
                    : subchat
            )
        );
    };

    const selectionPosition = pendingSelection?.position;

    const popupTop = selectionPosition
        ? Math.max(8, selectionPosition.top - 48)
        : 0;

    const popupLeft = selectionPosition
        ? Math.max(
            8,
            Math.min(selectionPosition.left, window.innerWidth - 220)
        )
        : 0;

    return (
        <div className="chat-layout">
            <main className="chat">
                <div className="messages">
                    {messages.length === 0 && !isSending && (
                        <div className="empty-chat">
                            <h2>What would you like to explore?</h2>
                            <p>
                                Ask a question, then select a phrase in the AI response
                                to explore it in a separate Subchat.
                            </p>
                        </div>
                    )}

                    {messages.map((message) => (
                        <Message
                            key={message.id}
                            id={message.id}
                            role={message.role}
                            content={message.content}
                            onTextSelect={handleTextSelect}
                        />
                    ))}

                    {isSending && (
                        <div className="message assistant">
                            <div className="message-label">AI</div>
                            <div className="message-content">Thinking...</div>
                        </div>
                    )}
                </div>

                <ChatInput
                    onSend={handleMainSend}
                    disabled={isSending}
                />
            </main>

            {pendingSelection && selectionPosition && (
                <div
                    className="selection-popup"
                    style={{
                        top: `${popupTop}px`,
                        left: `${popupLeft}px`,
                    }}
                >
                    <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={openSubchat}
                    >
                        Explore in Subchat <span aria-hidden="true">↗</span>
                    </button>
                </div>
            )}

            {subchats.length > 0 && (
                <div className="subchat-stack">
                    {subchats.map((subchat) => (
                        <Subchat
                            key={subchat.id}
                            concept={subchat.concept}
                            originalQuestion={subchat.originalQuestion || ""}
                            sourceMessage={subchat.sourceMessage || ""}
                            contextMessages={subchat.contextMessages || []}
                            messages={subchat.messages}
                            setMessages={(newMessages) =>
                                updateSubchatMessages(subchat.id, newMessages)
                            }
                            isCollapsed={subchat.isCollapsed}
                            onToggleCollapsed={() =>
                                toggleSubchatCollapsed(subchat.id)
                            }
                            onClose={() => closeSubchat(subchat.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Chat;
