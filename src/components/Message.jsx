
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

function formatMarkdown(text = "") {
    return text
        .replace(/\\([#*_|])/g, "$1")
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math}\n$$\n`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`)
        .replace(/\\([`~])/g, "$1");
}

function Message({ id, role, content, onTextSelect }) {
    const handleMouseUp = () => {
        if (role !== "assistant") return;

        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (!selectedText || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        onTextSelect({
            text: selectedText,
            sourceMessage: content,
            sourceMessageId: id,
            position: {
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right
            }
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
                {role === "assistant" ? (
                    <div className="markdown-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                                a: ({ node, ...props }) => (
                                    <a
                                        {...props}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    />
                                ),
                                table: ({ node, ...props }) => (
                                    <div className="markdown-table-wrapper">
                                        <table {...props} />
                                    </div>
                                ),
                                pre: ({ node, ...props }) => (
                                    <pre {...props} />
                                ),
                                code: ({ node, className, children, ...props }) => (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                )
                            }}
                        >
                            {formatMarkdown(content)}
                        </ReactMarkdown>
                    </div>
                ) : (
                    content
                )}
            </div>
        </div>
    );
}

export default Message;
