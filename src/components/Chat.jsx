
import { useEffect, useState } from "react";
import Message from "./Message";
import ChatInput from "./ChatInput";
import Subchat from "./Subchat";

const CHATS_STORAGE_KEY = "subchat-chat-history";
const OLD_MESSAGES_KEY = "subchat-main-messages";
const OLD_SUBCHATS_KEY = "subchat-saved-conversations";
const ACTIVE_CHAT_KEY = "subchat-active-chat";

function createChat(title = "New Chat") {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        messages: [],
        subchats: [],
        pinned: false,
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
                const validChats = parsed
                    .filter((chat) => chat && chat.id)
                    .map((chat) => ({
                        ...chat,
                        title: chat.title || "New Chat",
                        pinned: Boolean(chat.pinned),
                        messages: isValidMessages(chat.messages)
                            ? chat.messages
                            : [],
                        subchats: Array.isArray(chat.subchats)
                            ? chat.subchats
                                .filter(
                                    (subchat) =>
                                        subchat &&
                                        subchat.id !== undefined &&
                                        typeof subchat.concept === "string" &&
                                        Array.isArray(subchat.messages)
                                )
                                .map((subchat) => ({
                                    ...subchat,
                                    messages: isValidMessages(subchat.messages)
                                        ? subchat.messages
                                        : [],
                                    contextMessages: Array.isArray(
                                        subchat.contextMessages
                                    )
                                        ? subchat.contextMessages
                                        : [],
                                    isCollapsed: Boolean(subchat.isCollapsed),
                                }))
                            : [],
                    }));

                if (validChats.length > 0) return validChats;
            }
        }

        // Migrate conversations saved by the earlier version.
        const oldMessages = JSON.parse(
            localStorage.getItem(OLD_MESSAGES_KEY) || "[]"
        );

        const oldSubchats = JSON.parse(
            localStorage.getItem(OLD_SUBCHATS_KEY) || "[]"
        );

        const initialChat = createChat(
            Array.isArray(oldMessages) && oldMessages.length > 0
                ? String(
                    oldMessages.find((message) => message.role === "user")
                        ?.content || "Previous Chat"
                ).slice(0, 40)
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

function loadActiveChatId() {
    try {
        return localStorage.getItem(ACTIVE_CHAT_KEY);
    } catch {
        return null;
    }
}

function Chat() {
    const [chats, setChats] = useState(loadChats);
    const [activeChatId, setActiveChatId] = useState(loadActiveChatId);
    const [pendingSelection, setPendingSelection] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState(null);

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

        if (activeChatId !== activeChat.id) {
            setActiveChatId(activeChat.id);
        }

        try {
            localStorage.setItem(ACTIVE_CHAT_KEY, activeChat.id);
        } catch (error) {
            console.error("Could not save active chat:", error);
        }
    }, [activeChat, activeChatId]);

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

    const updateChat = (chatId, updater) => {
        setChats((previous) =>
            previous.map((chat) =>
                chat.id === chatId ? updater(chat) : chat
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

    const handleTogglePin = (chatId) => {
        updateChat(chatId, (chat) => ({ ...chat, pinned: !chat.pinned }));
    };

    const requestDeleteChat = (chat) => {
        setDeleteConfirmation({ id: chat.id, title: chat.title || "New Chat" });
    };

    const cancelDeleteChat = () => setDeleteConfirmation(null);

    const confirmDeleteChat = () => {
        if (!deleteConfirmation) return;

        const deletedChatId = deleteConfirmation.id;
        const remainingChats = chats.filter((chat) => chat.id !== deletedChatId);
        const nextChats = remainingChats.length > 0 ? remainingChats : [createChat()];

        setChats(nextChats);
        if (activeChatId === deletedChatId) {
            const nextActiveChat = remainingChats.length > 0
                ? remainingChats[remainingChats.length - 1]
                : nextChats[0];
            setActiveChatId(nextActiveChat.id);
        }
        if (pendingSelection?.chatId === deletedChatId) setPendingSelection(null);
        setDeleteConfirmation(null);
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

        updateChat(chatId, (chat) => ({
            ...chat,
            title:
                chat.messages.length === 0
                    ? text.trim().slice(0, 40)
                    : chat.title,
            messages: updatedMessages,
        }));

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

            updateChat(chatId, (chat) => ({
                ...chat,
                messages: [
                    ...chat.messages,
                    {
                        id: `${Date.now()}-assistant`,
                        role: "assistant",
                        content: data.reply,
                    },
                ],
            }));
        } catch (error) {
            console.error("Main chat error:", error);

            updateChat(chatId, (chat) => ({
                ...chat,
                messages: [
                    ...chat.messages,
                    {
                        id: `${Date.now()}-error`,
                        role: "assistant",
                        content: `Sorry, I couldn't generate a response. ${error.message}`,
                    },
                ],
            }));
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
        if (!text || !position || !activeChat) return;

        setPendingSelection({
            text,
            sourceMessage,
            sourceMessageId,
            position,
            chatId: activeChat.id,
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
                    ? precedingUserMessages[precedingUserMessages.length - 1]
                        .content
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

        updateChat(activeChat.id, (chat) => ({
            ...chat,
            subchats: [...chat.subchats, newSubchat],
        }));

        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const closeSubchat = (id) => {
        if (!activeChat) return;

        updateChat(activeChat.id, (chat) => ({
            ...chat,
            subchats: chat.subchats.filter((subchat) => subchat.id !== id),
        }));
    };

    const updateSubchatMessages = (chatId, subchatId, newMessages) => {
        if (!Array.isArray(newMessages)) return;

        updateChat(chatId, (chat) => ({
            ...chat,
            subchats: chat.subchats.map((subchat) =>
                subchat.id === subchatId
                    ? { ...subchat, messages: newMessages }
                    : subchat
            ),
        }));
    };

    const toggleSubchatCollapsed = (id) => {
        if (!activeChat) return;

        updateChat(activeChat.id, (chat) => ({
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
        <div className={`chat-layout ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
            <aside className={`history-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
                <div className="sidebar-top">
                    {!sidebarCollapsed && (
                        <div className="sidebar-brand">
                            <span className="brand-mark">S</span>
                            <span>Subchat</span>
                        </div>
                    )}

                    <button
                        type="button"
                        className="sidebar-toggle"
                        onClick={() => setSidebarCollapsed((value) => !value)}
                        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {sidebarCollapsed ? "☰" : "‹"}
                    </button>
                </div>

                <button
                    type="button"
                    className="sidebar-new-chat"
                    onClick={handleNewChat}
                    disabled={isSending}
                    title="New Chat"
                >
                    <span className="new-chat-symbol">＋</span>
                    {!sidebarCollapsed && <span>New Chat</span>}
                </button>

                {!sidebarCollapsed && (
                    <>
                        {chats.some((chat) => chat.pinned) && (
                            <>
                                <div className="sidebar-section-label">PINNED</div>
                                <div className="chat-history-list">
                                    {[...chats].filter((chat) => chat.pinned).reverse().map((chat) => (
                                        <ChatHistoryItem
                                            key={chat.id}
                                            chat={chat}
                                            active={chat.id === activeChat?.id}
                                            disabled={isSending}
                                            onSelect={() => handleSelectChat(chat.id)}
                                            onTogglePin={() => handleTogglePin(chat.id)}
                                            onDelete={() => requestDeleteChat(chat)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="sidebar-section-label">YOUR CHATS</div>
                        <div className="chat-history-list">
                            {[...chats].filter((chat) => !chat.pinned).reverse().map((chat) => (
                                <ChatHistoryItem
                                    key={chat.id}
                                    chat={chat}
                                    active={chat.id === activeChat?.id}
                                    disabled={isSending}
                                    onSelect={() => handleSelectChat(chat.id)}
                                    onTogglePin={() => handleTogglePin(chat.id)}
                                    onDelete={() => requestDeleteChat(chat)}
                                />
                            ))}
                        </div>

                        <div className="sidebar-footer">
                            Contextual exploration, without losing your place.
                        </div>
                    </>
                )}
            </aside>

            <main className="chat">
                <div className="chat-topbar">
                    <div className="chat-topbar-title">
                        {activeChat?.title || "New Chat"}
                    </div>

                    <button
                        type="button"
                        className="new-chat-button"
                        onClick={handleNewChat}
                        disabled={isSending}
                    >
                        + New Chat
                    </button>
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
                                updateSubchatMessages(
                                    activeChat.id,
                                    subchat.id,
                                    newMessages
                                )
                            }
                            isCollapsed={subchat.isCollapsed}
                            onToggleCollapsed={() => toggleSubchatCollapsed(subchat.id)}
                            onClose={() => closeSubchat(subchat.id)}
                        />
                    ))}
                </div>
            )}

            {deleteConfirmation && (
                <div className="confirm-modal-backdrop" role="presentation" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) cancelDeleteChat();
                }}>
                    <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-chat-title" aria-describedby="delete-chat-description">
                        <div className="confirm-modal-icon" aria-hidden="true">
                            <Icon name="trash" size={22} />
                        </div>
                        <h2 id="delete-chat-title">Confirm delete chat</h2>
                        <p id="delete-chat-description">
                            Are you sure you want to delete <strong>“{deleteConfirmation.title}”</strong>? This will also delete its Subchats. This action cannot be undone.
                        </p>
                        <div className="confirm-modal-actions">
                            <button type="button" className="confirm-cancel-button" onClick={cancelDeleteChat}>Cancel</button>
                            <button type="button" className="confirm-delete-button" onClick={confirmDeleteChat}>
                                <Icon name="trash" size={16} /> Delete chat
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function Icon({ name, size = 16 }) {
    const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
    if (name === "pin") return <svg {...common}><path d="M16 3l5 5-4 1-4 4-1 5-2-2-2-2-2-2 5-1 4-4z" /><path d="M5 19l6-6" /></svg>;
    if (name === "trash") return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 10v6M14 10v6" /></svg>;
    if (name === "chat") return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /></svg>;
    return null;
}

function ChatHistoryItem({ chat, active, disabled, onSelect, onTogglePin, onDelete }) {
    return (
        <div className={`chat-history-row ${active ? "active" : ""}`}>
            <button type="button" className={`chat-history-item ${active ? "active" : ""}`} onClick={onSelect} disabled={disabled} title={chat.title}>
                <span className="history-chat-icon"><Icon name="chat" size={16} /></span>
                <span className="history-chat-title">{chat.title}</span>
                {chat.subchats?.length > 0 && <span className="history-subchat-count" title={`${chat.subchats.length} Subchat(s)`}>{chat.subchats.length}</span>}
            </button>
            <div className="chat-history-actions">
                <button type="button" className={`history-action-button ${chat.pinned ? "is-pinned" : ""}`} onClick={onTogglePin} title={chat.pinned ? "Unpin chat" : "Pin chat"} aria-label={chat.pinned ? `Unpin ${chat.title}` : `Pin ${chat.title}`} disabled={disabled}>
                    <Icon name="pin" size={15} />
                </button>
                <button type="button" className="history-action-button delete-history-button" onClick={onDelete} title="Delete chat" aria-label={`Delete ${chat.title}`} disabled={disabled}>
                    <Icon name="trash" size={15} />
                </button>
            </div>
        </div>
    );
}

export default Chat;
