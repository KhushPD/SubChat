
import { useEffect, useState } from "react";
import Message from "./Message";
import ChatInput from "./ChatInput";
import Subchat from "./Subchat";
import messages from "../data/messages";

const STORAGE_KEY = "subchat-saved-conversations";

function loadSavedSubchats() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) return [];

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(
            (subchat) =>
                subchat &&
                subchat.id !== undefined &&
                typeof subchat.concept === "string" &&
                Array.isArray(subchat.messages)
        ).map((subchat) => ({
            ...subchat,
            isCollapsed: Boolean(subchat.isCollapsed)
        }));
    } catch (error) {
        console.error("Could not restore saved Subchats:", error);
        return [];
    }
}

function Chat() {
    const [pendingSelection, setPendingSelection] = useState(null);
    const [subchats, setSubchats] = useState(loadSavedSubchats);

    const originalQuestion = messages.find(
        (message) => message.role === "user"
    );

    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(subchats)
            );
        } catch (error) {
            console.error("Could not save Subchats:", error);
        }
    }, [subchats]);

    const handleTextSelect = ({ text, sourceMessage }) => {
        setPendingSelection({
            text,
            sourceMessage
        });
    };

    const openSubchat = () => {
        if (!pendingSelection) return;

        const newSubchat = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            concept: pendingSelection.text,
            sourceMessage: pendingSelection.sourceMessage,
            isCollapsed: false,
            messages: [
                {
                    id: `initial-${Date.now()}`,
                    role: "assistant",
                    content: `Let's explore "${pendingSelection.text}" in more detail. What would you like to understand about it?`
                }
            ]
        };

        setSubchats((previous) => [
            ...previous,
            newSubchat
        ]);

        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
    };

    const closeSubchat = (id) => {
        setSubchats((previous) =>
            previous.filter((subchat) => subchat.id !== id)
        );
    };

    const updateSubchatMessages = (id, newMessages) => {
        setSubchats((previous) =>
            previous.map((subchat) =>
                subchat.id === id
                    ? {
                        ...subchat,
                        messages: newMessages
                    }
                    : subchat
            )
        );
    };

    const toggleSubchatCollapsed = (id) => {
        setSubchats((previous) =>
            previous.map((subchat) =>
                subchat.id === id
                    ? {
                        ...subchat,
                        isCollapsed: !subchat.isCollapsed
                    }
                    : subchat
            )
        );
    };

    return (
        <div className="chat-layout">
            <main className="chat">
                <div className="messages">
                    {messages.map((message) => (
                        <Message
                            key={message.id}
                            role={message.role}
                            content={message.content}
                            onTextSelect={handleTextSelect}
                        />
                    ))}

                    {pendingSelection && (
                        <div className="selection-action">
                            <div className="selection-preview">
                                <span>Selected</span>
                                <strong>
                                    "{pendingSelection.text}"
                                </strong>
                            </div>

                            <button onClick={openSubchat}>
                                Explore in Subchat →
                            </button>
                        </div>
                    )}
                </div>

                <ChatInput />
            </main>

            {subchats.length > 0 && (
                <div className="subchat-stack">
                    {subchats.map((subchat) => (
                        <Subchat
                            key={subchat.id}
                            concept={subchat.concept}
                            originalQuestion={originalQuestion?.content}
                            sourceMessage={subchat.sourceMessage}
                            messages={subchat.messages}
                            setMessages={(newMessages) =>
                                updateSubchatMessages(
                                    subchat.id,
                                    newMessages
                                )
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
