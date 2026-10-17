
import { useEffect, useState, useRef } from "react";
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
                    }))
                    .filter((chat) => chat.messages && chat.messages.length > 0);

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

        if (Array.isArray(oldMessages) && oldMessages.length > 0 && isValidMessages(oldMessages)) {
            const initialChat = createChat(
                String(
                    oldMessages.find((message) => message.role === "user")
                        ?.content || "Previous Chat"
                ).slice(0, 40)
            );

            initialChat.messages = oldMessages;

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
        }

        return [createChat()];
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

function getInitialActiveChatId(chats) {
    const saved = loadActiveChatId();
    if (saved && chats.some((chat) => chat.id === saved)) {
        return saved;
    }
    return chats.length > 0 ? chats[chats.length - 1].id : null;
}

/** Categorize chats into time buckets like ChatGPT */
function categorizeChatsByDate(chats) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const buckets = {
        today: [],
        yesterday: [],
        previous7: [],
        older: [],
    };

    [...chats].reverse().forEach((chat) => {
        // Extract timestamp from id (format: timestamp-randomstring)
        const ts = parseInt(chat.id.split("-")[0], 10);
        const chatDate = new Date(ts);

        if (chatDate >= today) {
            buckets.today.push(chat);
        } else if (chatDate >= yesterday) {
            buckets.yesterday.push(chat);
        } else if (chatDate >= sevenDaysAgo) {
            buckets.previous7.push(chat);
        } else {
            buckets.older.push(chat);
        }
    });

    return buckets;
}

function Chat() {
    const [chats, setChats] = useState(loadChats);
    const [activeChatId, setActiveChatId] = useState(() => getInitialActiveChatId(chats));
    const [pendingSelection, setPendingSelection] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [subchatHidden, setSubchatHidden] = useState(false);
    const [closingSubchatIds, setClosingSubchatIds] = useState([]);
    const [isClosingStack, setIsClosingStack] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState(null);
    const [renamingChatId, setRenamingChatId] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [menuOpenChatId, setMenuOpenChatId] = useState(null);
    const pendingScrollPromptIdRef = useRef(null);

    const activeChat =
        chats.find((chat) => chat.id === activeChatId) ||
        chats[chats.length - 1] ||
        chats[0];

    const messages = activeChat?.messages || [];
    const subchats = activeChat?.subchats || [];

    // When writing a prompt, scroll to the prompt at the top so user stays at the start of the generated answer
    useEffect(() => {
        if (pendingScrollPromptIdRef.current) {
            const promptId = pendingScrollPromptIdRef.current;
            const el = document.getElementById(`msg-${promptId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
                pendingScrollPromptIdRef.current = null;
            }
        }
    }, [messages.length]);

    useEffect(() => {
        try {
            const chatsToSave = chats.filter(
                (chat) => chat.messages && chat.messages.length > 0
            );
            localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chatsToSave));
        } catch (error) {
            console.error("Could not save chat history:", error);
        }
    }, [chats]);

    useEffect(() => {
        if (!activeChat) return;

        try {
            if (activeChat.messages && activeChat.messages.length > 0) {
                localStorage.setItem(ACTIVE_CHAT_KEY, activeChat.id);
            } else {
                localStorage.removeItem(ACTIVE_CHAT_KEY);
            }
        } catch (error) {
            console.error("Could not save active chat:", error);
        }
    }, [activeChat]);

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

    // Close menu on outside click
    useEffect(() => {
        if (!menuOpenChatId) return;
        const handleClick = () => setMenuOpenChatId(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, [menuOpenChatId]);

    const updateChat = (chatId, updater) => {
        setChats((previous) =>
            previous.map((chat) =>
                chat.id === chatId ? updater(chat) : chat
            )
        );
    };

    const handleNewChat = () => {
        if (isSending) return;

        // If currently already on an unstarted chat (0 messages), just remain on it
        if (activeChat && (!activeChat.messages || activeChat.messages.length === 0)) {
            setSubchatHidden(false);
            setPendingSelection(null);
            window.getSelection()?.removeAllRanges();
            return;
        }

        const newChat = createChat();

        // Prune any existing unstarted chats and add the new empty chat
        setChats((previous) => [
            ...previous.filter((chat) => chat.messages && chat.messages.length > 0),
            newChat,
        ]);
        setActiveChatId(newChat.id);
        setSubchatHidden(false);
        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const handleSelectChat = (chatId) => {
        if (isSending || chatId === activeChat?.id) return;

        // Discard any unstarted chats when switching to an existing chat
        setChats((previous) =>
            previous.filter(
                (chat) => chat.id === chatId || (chat.messages && chat.messages.length > 0)
            )
        );
        setActiveChatId(chatId);
        setSubchatHidden(false);
        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const requestDeleteChat = (chat) => {
        setDeleteConfirmation({ id: chat.id, title: chat.title || "New Chat" });
        setMenuOpenChatId(null);
    };

    const cancelDeleteChat = () => setDeleteConfirmation(null);

    const confirmDeleteChat = () => {
        if (!deleteConfirmation) return;

        const deletedChatId = deleteConfirmation.id;
        const remainingChats = chats.filter((chat) => chat.id !== deletedChatId);
        const startedRemainingChats = remainingChats.filter(
            (chat) => chat.messages && chat.messages.length > 0
        );

        let nextChats;
        let nextActiveChatId;

        const activeWasUnstarted =
            activeChat &&
            activeChat.id !== deletedChatId &&
            (!activeChat.messages || activeChat.messages.length === 0);

        if (activeWasUnstarted) {
            nextChats = [...startedRemainingChats, activeChat];
            nextActiveChatId = activeChat.id;
        } else if (startedRemainingChats.length > 0) {
            nextChats = startedRemainingChats;
            if (activeChatId === deletedChatId) {
                nextActiveChatId =
                    startedRemainingChats[startedRemainingChats.length - 1].id;
            } else {
                nextActiveChatId = activeChatId;
            }
        } else {
            const freshChat = createChat();
            nextChats = [freshChat];
            nextActiveChatId = freshChat.id;
        }

        setChats(nextChats);
        setActiveChatId(nextActiveChatId);
        if (pendingSelection?.chatId === deletedChatId) setPendingSelection(null);
        setDeleteConfirmation(null);
        setSubchatHidden(false);
        window.getSelection()?.removeAllRanges();
    };

    const handleStartRename = (chat) => {
        setRenamingChatId(chat.id);
        setRenameValue(chat.title || "");
        setMenuOpenChatId(null);
    };

    const handleConfirmRename = () => {
        if (renamingChatId && renameValue.trim()) {
            updateChat(renamingChatId, (chat) => ({ ...chat, title: renameValue.trim() }));
        }
        setRenamingChatId(null);
        setRenameValue("");
    };

    const handleMainSend = async (text) => {
        if (isSending || !text.trim() || !activeChat) return;

        const chatId = activeChat.id;

        const userMessage = {
            id: `${Date.now()}-user`,
            role: "user",
            content: text.trim(),
        };

        pendingScrollPromptIdRef.current = userMessage.id;

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

        setSubchatHidden(false);
        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const closeSubchat = (id) => {
        if (!activeChat || closingSubchatIds.includes(id)) return;

        const chatIdToUpdate = activeChat.id;
        const isLastSubchat = subchats.length <= 1;

        setClosingSubchatIds((current) => [...current, id]);
        if (isLastSubchat) {
            setIsClosingStack(true);
        }

        // Let the closing animation finish before removing the panel from React.
        window.setTimeout(() => {
            updateChat(chatIdToUpdate, (chat) => ({
                ...chat,
                subchats: chat.subchats.filter((subchat) => subchat.id !== id),
            }));

            setClosingSubchatIds((current) => current.filter((closingId) => closingId !== id));
            setIsClosingStack(false);

            if (isLastSubchat && activeChatId === chatIdToUpdate) {
                setSubchatHidden(false);
            }
        }, 360);
    };

    const handleHideSubchat = () => {
        if (isClosingStack || subchatHidden) return;
        setIsClosingStack(true);
        window.setTimeout(() => {
            setSubchatHidden(true);
            setIsClosingStack(false);
        }, 360);
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

    const historyChats = chats.filter(
        (chat) => chat.messages && chat.messages.length > 0
    );
    const dateBuckets = categorizeChatsByDate(historyChats);

    return (
        <div className={`chat-layout ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
            {/* ===== SIDEBAR ===== */}
            <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
                <div className="sidebar-top">
                    <button
                        type="button"
                        className="sidebar-toggle-btn"
                        onClick={() => setSidebarCollapsed((v) => !v)}
                        title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
                        aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M9 3v18" />
                        </svg>
                    </button>

                    {!sidebarCollapsed && (
                        <button
                            type="button"
                            className="sidebar-new-chat-btn"
                            onClick={handleNewChat}
                            disabled={isSending}
                            title="New chat"
                            aria-label="New chat"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </button>
                    )}
                </div>

                {!sidebarCollapsed && (
                    <div className="sidebar-history">
                        {dateBuckets.today.length > 0 && (
                            <div className="history-section">
                                <div className="history-section-label">Today</div>
                                {dateBuckets.today.map((chat) => (
                                    <ChatHistoryItem
                                        key={chat.id}
                                        chat={chat}
                                        active={chat.id === activeChat?.id}
                                        disabled={isSending}
                                        isRenaming={renamingChatId === chat.id}
                                        renameValue={renameValue}
                                        onRenameChange={setRenameValue}
                                        onRenameConfirm={handleConfirmRename}
                                        menuOpen={menuOpenChatId === chat.id}
                                        onMenuToggle={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenChatId(menuOpenChatId === chat.id ? null : chat.id);
                                        }}
                                        onSelect={() => handleSelectChat(chat.id)}
                                        onRename={() => handleStartRename(chat)}
                                        onDelete={() => requestDeleteChat(chat)}
                                    />
                                ))}
                            </div>
                        )}

                        {dateBuckets.yesterday.length > 0 && (
                            <div className="history-section">
                                <div className="history-section-label">Yesterday</div>
                                {dateBuckets.yesterday.map((chat) => (
                                    <ChatHistoryItem
                                        key={chat.id}
                                        chat={chat}
                                        active={chat.id === activeChat?.id}
                                        disabled={isSending}
                                        isRenaming={renamingChatId === chat.id}
                                        renameValue={renameValue}
                                        onRenameChange={setRenameValue}
                                        onRenameConfirm={handleConfirmRename}
                                        menuOpen={menuOpenChatId === chat.id}
                                        onMenuToggle={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenChatId(menuOpenChatId === chat.id ? null : chat.id);
                                        }}
                                        onSelect={() => handleSelectChat(chat.id)}
                                        onRename={() => handleStartRename(chat)}
                                        onDelete={() => requestDeleteChat(chat)}
                                    />
                                ))}
                            </div>
                        )}

                        {dateBuckets.previous7.length > 0 && (
                            <div className="history-section">
                                <div className="history-section-label">Previous 7 Days</div>
                                {dateBuckets.previous7.map((chat) => (
                                    <ChatHistoryItem
                                        key={chat.id}
                                        chat={chat}
                                        active={chat.id === activeChat?.id}
                                        disabled={isSending}
                                        isRenaming={renamingChatId === chat.id}
                                        renameValue={renameValue}
                                        onRenameChange={setRenameValue}
                                        onRenameConfirm={handleConfirmRename}
                                        menuOpen={menuOpenChatId === chat.id}
                                        onMenuToggle={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenChatId(menuOpenChatId === chat.id ? null : chat.id);
                                        }}
                                        onSelect={() => handleSelectChat(chat.id)}
                                        onRename={() => handleStartRename(chat)}
                                        onDelete={() => requestDeleteChat(chat)}
                                    />
                                ))}
                            </div>
                        )}

                        {dateBuckets.older.length > 0 && (
                            <div className="history-section">
                                <div className="history-section-label">Older</div>
                                {dateBuckets.older.map((chat) => (
                                    <ChatHistoryItem
                                        key={chat.id}
                                        chat={chat}
                                        active={chat.id === activeChat?.id}
                                        disabled={isSending}
                                        isRenaming={renamingChatId === chat.id}
                                        renameValue={renameValue}
                                        onRenameChange={setRenameValue}
                                        onRenameConfirm={handleConfirmRename}
                                        menuOpen={menuOpenChatId === chat.id}
                                        onMenuToggle={(e) => {
                                            e.stopPropagation();
                                            setMenuOpenChatId(menuOpenChatId === chat.id ? null : chat.id);
                                        }}
                                        onSelect={() => handleSelectChat(chat.id)}
                                        onRename={() => handleStartRename(chat)}
                                        onDelete={() => requestDeleteChat(chat)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom user section */}
                {!sidebarCollapsed && (
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">S</div>
                        <span className="sidebar-user-name">SubChat User</span>
                    </div>
                )}
            </aside>

            {/* ===== MAIN ===== */}
            <main className="main-canvas">
                {/* Sticky header */}
                <header className="main-header">
                    {sidebarCollapsed && (
                        <button
                            type="button"
                            className="header-sidebar-toggle"
                            onClick={() => setSidebarCollapsed(false)}
                            title="Open sidebar"
                            aria-label="Open sidebar"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M9 3v18" />
                            </svg>
                        </button>
                    )}

                    <div className="header-model">
                        <span>SubChat</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>

                    <div className="header-actions">
                        <button
                            type="button"
                            className="header-action-btn"
                            title="Share"
                            aria-label="Share conversation"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            className="header-action-btn"
                            onClick={handleNewChat}
                            disabled={isSending}
                            title="New chat"
                            aria-label="New chat"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Message stream */}
                <div className="message-stream">
                    <div className="message-stream-inner">
                        {messages.length === 0 && !isSending && (
                            <div className="empty-state">
                                <div className="empty-logo">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path d="M12 3.5 14.4 9.6 20.5 12l-6.1 2.4L12 20.5l-2.4-6.1L3.5 12l6.1-2.4L12 3.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <h1 className="empty-heading">What can I help with?</h1>
                                <div className="empty-prompts">
                                    <button type="button" onClick={() => handleMainSend("Explain a complex idea in simple terms, with an example.")} disabled={isSending}>
                                        Explain a complex idea simply
                                    </button>
                                    <button type="button" onClick={() => handleMainSend("Help me brainstorm creative ideas for a project.")} disabled={isSending}>
                                        Brainstorm creative ideas
                                    </button>
                                    <button type="button" onClick={() => handleMainSend("Teach me something surprising about how the world works.")} disabled={isSending}>
                                        Teach me something new
                                    </button>
                                </div>
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
                            <div className="message-row assistant-row">
                                <div className="assistant-avatar">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path d="M12 3.5 14.4 9.6 20.5 12l-6.1 2.4L12 20.5l-2.4-6.1L3.5 12l6.1-2.4L12 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <div className="assistant-content">
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Floating input */}
                <ChatInput
                    onSend={handleMainSend}
                    disabled={isSending}
                />
            </main>

            {/* ===== Selection popup ===== */}
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
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
                            Explore in Subchat
                        </button>
                    </div>
                )}

            {/* ===== Subchat panel ===== */}
            {subchats.length > 0 && (
                <>
                    {subchatHidden && (
                        <button
                            type="button"
                            className="subchat-reopen-tab"
                            onClick={() => setSubchatHidden(false)}
                            aria-label="Show Subchat sidebar"
                            title="Show Subchat sidebar"
                        >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" stroke="currentColor" strokeWidth="1.7" />
                                <path d="M14.5 4v16" stroke="currentColor" strokeWidth="1.7" />
                                <path d="m8 9 3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Subchat</span>
                            <span className="subchat-reopen-count">{subchats.length}</span>
                        </button>
                    )}

                    <div
                        className={`subchat-stack ${subchatHidden ? "subchat-stack-hidden" : ""} ${isClosingStack ? "is-closing" : ""}`}
                        aria-hidden={subchatHidden}
                    >
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
                                isClosing={closingSubchatIds.includes(subchat.id)}
                                onToggleCollapsed={() => toggleSubchatCollapsed(subchat.id)}
                                onFocusMain={handleHideSubchat}
                                onClose={() => closeSubchat(subchat.id)}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* ===== Delete confirmation ===== */}
            {deleteConfirmation && (
                <div className="confirm-modal-backdrop" role="presentation" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) cancelDeleteChat();
                }}>
                    <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-chat-title" aria-describedby="delete-chat-description">
                        <h2 id="delete-chat-title">Delete chat?</h2>
                        <p id="delete-chat-description">
                            This will delete <strong>"{deleteConfirmation.title}"</strong> and its Subchats.
                        </p>
                        <div className="confirm-modal-actions">
                            <button type="button" className="confirm-cancel-btn" onClick={cancelDeleteChat}>Cancel</button>
                            <button type="button" className="confirm-delete-btn" onClick={confirmDeleteChat}>Delete</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function ChatHistoryItem({ chat, active, disabled, isRenaming, renameValue, onRenameChange, onRenameConfirm, menuOpen, onMenuToggle, onSelect, onRename, onDelete }) {
    return (
        <div className={`history-item ${active ? "active" : ""}`}>
            {isRenaming ? (
                <input
                    className="history-rename-input"
                    type="text"
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onBlur={onRenameConfirm}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onRenameConfirm();
                        if (e.key === "Escape") onRenameConfirm();
                    }}
                    autoFocus
                />
            ) : (
                <button
                    type="button"
                    className="history-item-btn"
                    onClick={onSelect}
                    disabled={disabled}
                    title={chat.title}
                >
                    <span className="history-item-title">{chat.title}</span>
                </button>
            )}

            <div className="history-item-menu-wrapper">
                <button
                    type="button"
                    className="history-dots-btn"
                    onClick={onMenuToggle}
                    title="More"
                    aria-label="Chat options"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                    </svg>
                </button>

                {menuOpen && (
                    <div className="history-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={onRename}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                            Rename
                        </button>
                        <button type="button" className="danger" onClick={onDelete}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Chat;
