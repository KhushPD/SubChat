import { useState } from "react";
import Message from "./Message";
import ChatInput from "./ChatInput";
import Subchat from "./Subchat";
import messages from "../data/messages";

function Chat() {
    const [pendingSelection, setPendingSelection] = useState(null);
    const [subchats, setSubchats] = useState([]);

    const originalQuestion = messages.find(
        (message) => message.role === "user"
    );

    const handleTextSelect = ({ text, sourceMessage }) => {
        setPendingSelection({
            text,
            sourceMessage
        });
    };

    const openSubchat = () => {
        if (!pendingSelection) return;

        const newSubchat = {
            id: Date.now(),
            concept: pendingSelection.text,
            sourceMessage: pendingSelection.sourceMessage,
            messages: [
                {
                    id: `initial-${Date.now()}`,
                    role: "assistant",
                    content: `Let's explore "${pendingSelection.text}" in more detail. What would you like to understand about it?`
                }
            ]
        };

        setSubchats((prev) => [
            ...prev,
            newSubchat
        ]);

        setPendingSelection(null);

        window.getSelection()?.removeAllRanges();
    };

    const closeSubchat = (id) => {
        setSubchats((prev) =>
            prev.filter((subchat) => subchat.id !== id)
        );
    };

    const updateSubchatMessages = (
        id,
        newMessages
    ) => {
        setSubchats((prev) =>
            prev.map((subchat) =>
                subchat.id === id
                    ? {
                        ...subchat,
                        messages: newMessages
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
                            originalQuestion={
                                originalQuestion?.content
                            }
                            sourceMessage={
                                subchat.sourceMessage
                            }
                            messages={subchat.messages}
                            setMessages={(newMessages) =>
                                updateSubchatMessages(
                                    subchat.id,
                                    newMessages
                                )
                            }
                            onClose={() =>
                                closeSubchat(subchat.id)
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Chat;