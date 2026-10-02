function Message({ role, content, onTextSelect }) {
    const handleMouseUp = () => {
        if (role !== "assistant") return;

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (!selectedText) return;

        onTextSelect({
            text: selectedText,
            sourceMessage: content
        });
    };

    return (
        <div className={`message ${role}`}>
            <div className="message-label">
                {role === "user" ? "You" : "AI"}
            </div>

            <div
                className="message-content"
                onMouseUp={handleMouseUp}
            >
                {content}
            </div>
        </div>
    );
}

export default Message;