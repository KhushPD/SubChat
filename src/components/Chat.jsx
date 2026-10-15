
import { useEffect, useState } from "react";
import Message from "./Message";
import ChatInput from "./ChatInput";
import Subchat from "./Subchat";

const CHATS_STORAGE_KEY = "subchat-chat-history";
const OLD_MESSAGES_KEY = "subchat-main-messages";
const OLD_SUBCHATS_KEY = "subchat-saved-conversations";

function createChat(title = "New Chat") {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        messages: [],
        subchats: [],
    };
}

function isValidMessages(value) {
    return (
        Array.isArray(value) &&
        value.every(
            (message) =>
                message &&
                ["user", "assistant"].includes(message.role) &&
                typeof message.content === "string"
        )
    );
}

function loadChats() {
    try {
        const saved = localStorage.getItem(CHATS_STORAGE_KEY);

        if (saved) {
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed
                    .filter((chat) => chat && chat.id)
                    .map((chat) => ({
                        ...chat,
                        title: chat.title || "New Chat",
                        messages: isValidMessages(chat.messages)
                            ? chat.messages
                            : [],
                        subchats: Array.isArray(chat.subchats)
                            ? chat.subchats
                            : [],
                    }));
            }
        }

        // Migrate the existing single-chat data on first use.
        const oldMessages = JSON.parse(
            localStorage.getItem(OLD_MESSAGES_KEY) || "[]"
        );

        const oldSubchats = JSON.parse(
            localStorage.getItem(OLD_SUBCHATS_KEY) || "[]"
        );

        const initialChat = createChat(
            Array.isArray(oldMessages) && oldMessages.length > 0
                ? String(oldMessages.find((m) => m.role === "user")?.content || "Previous Chat").slice(0, 40)
                : "New Chat"
        );

        initialChat.messages = isValidMessages(oldMessages)
            ? oldMessages
            : [];

        initialChat.subchats = Array.isArray(oldSubchats)
            ? oldSubchats.filter(
                (subchat) =>
                    subchat &&
                    subchat.id !== undefined &&
                    typeof subchat.concept === "string" &&
                    Array.isArray(subchat.messages)
            )
            : [];

        return [initialChat];
    } catch (error) {
        console.error("Could not restore chat history:", error);
        return [createChat()];
    }
}

function Chat() {
    const [chats, setChats] = useState(loadChats);
    const [activeChatId, setActiveChatId] = useState(
        () => {
            try {
                return localStorage.getItem("subchat-active-chat");
            } catch {
                return null;
            }
        }
    );

    const [pendingSelection, setPendingSelection] = useState(null);
    const [isSending, setIsSending] = useState(false);

    const activeChat =
        chats.find((chat) => chat.id === activeChatId) || chats[0];

    const messages = activeChat?.messages || [];
    const subchats = activeChat?.subchats || [];

    useEffect(() => {
        try {
            localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
        } catch (error) {
            console.error("Could not save chat history:", error);
        }
    }, [chats]);

    useEffect(() => {
        if (!activeChat) return;

        setActiveChatId(activeChat.id);

        try {
            localStorage.setItem("subchat-active-chat", activeChat.id);
        } catch (error) {
            console.error("Could not save active chat:", error);
        }
    }, [activeChat?.id]);

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

    const updateActiveChat = (updater) => {
        if (!activeChat) return;

        setChats((previous) =>
            previous.map((chat) =>
                chat.id === activeChat.id ? updater(chat) : chat
            )
        );
    };

    const handleNewChat = () => {
        if (isSending) return;

        const newChat = createChat();

        setChats((previous) => [...previous, newChat]);
        setActiveChatId(newChat.id);
        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const handleSelectChat = (chatId) => {
        if (isSending || chatId === activeChat?.id) return;

        setActiveChatId(chatId);
        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const handleMainSend = async (text) => {
        if (isSending || !text.trim() || !activeChat) return;

        const chatId = activeChat.id;

        const userMessage = {
            id: `${Date.now()}-user`,
            role: "user",
            content: text.trim(),
        };

        const updatedMessages = [...messages, userMessage];

        setChats((previous) =>
            previous.map((chat) =>
                chat.id === chatId
                    ? {
                        ...chat,
                        title:
                            chat.messages.length === 0
                                ? text.trim().slice(0, 40)
                                : chat.title,
                        messages: updatedMessages,
                    }
                    : chat
            )
        );

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

            setChats((previous) =>
                previous.map((chat) =>
                    chat.id === chatId
                        ? {
                            ...chat,
                            messages: [
                                ...chat.messages,
                                {
                                    id: `${Date.now()}-assistant`,
                                    role: "assistant",
                                    content: data.reply,
                                },
                            ],
                        }
                        : chat
                )
            );
        } catch (error) {
            console.error("Main chat error:", error);

            setChats((previous) =>
                previous.map((chat) =>
                    chat.id === chatId
                        ? {
                            ...chat,
                            messages: [
                                ...chat.messages,
                                {
                                    id: `${Date.now()}-error`,
                                    role: "assistant",
                                    content: `Sorry, I couldn't generate a response. ${error.message}`,
                                },
                            ],
                        }
                        : chat
                )
            );
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
            chatId: activeChat?.id,
        });
    };

    const openSubchat = () => {
        if (!pendingSelection || !activeChat) return;
        if (pendingSelection.chatId !== activeChat.id) return;

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

        updateActiveChat((chat) => ({
            ...chat,
            subchats: [...chat.subchats, newSubchat],
        }));

        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const closeSubchat = (id) => {
        updateActiveChat((chat) => ({
            ...chat,
            subchats: chat.subchats.filter((subchat) => subchat.id !== id),
        }));
    };

    const updateSubchatMessages = (id, newMessages) => {
        if (!Array.isArray(newMessages)) return;

        updateActiveChat((chat) => ({
            ...chat,
            subchats: chat.subchats.map((subchat) =>
                subchat.id === id
                    ? { ...subchat, messages: newMessages }
                    : subchat
            ),
        }));
    };

    const toggleSubchatCollapsed = (id) => {
        updateActiveChat((chat) => ({
            ...chat,
            subchats: chat.subchats.map((subchat) =>
                subchat.id === id
                    ? { ...subchat, isCollapsed: !subchat.isCollapsed }
                    : subchat
            ),
        }));
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
                <div className="chat-topbar">
                    <div className="chat-topbar-title">Subchat</div>

                    <div className="chat-topbar-actions">
                        <select
                            className="chat-history-select"
                            value={activeChat?.id || ""}
                            onChange={(event) => handleSelectChat(event.target.value)}
                            disabled={isSending}
                            aria-label="Switch conversation"
                        >
                            {chats.map((chat) => (
                                <option key={chat.id} value={chat.id}>
                                    {chat.title}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            className="new-chat-button"
                            onClick={handleNewChat}
                            disabled={isSending}
                        >
                            + New Chat
                        </button>
                    </div>
                </div>

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

            {pendingSelection &&
                selectionPosition &&
                pendingSelection.chatId === activeChat?.id && (
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
